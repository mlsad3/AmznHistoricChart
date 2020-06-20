// https://stackoverflow.com/a/5947280/277601
(function(amazonfs, $, undefined) {
	var debug = false;
	// Keep info on the last 100 Amazon products
	var fakespotCache = new LRUMap(100);
	
	amazonfs.StatusEnum = { // TODO
		NONE : 0,
		BAD : 1,
		WAITING_FOR_PAGE_GENERATION : 3,
		ANALYZING : 4,
		NOT_ENOUGH_REVIEWS : 5,
		DONE : 6
	}
	
	/**
	 * Clear cached value for url
	 * */
	amazonfs.clearCache = function(amazonUrl){
		fakespotCache.delete(amazonUrl);
	}
	
	/**
	 * Decide what stage to skip to, based on cached values
	 * */
	amazonfs.triage = function(amazonUrl, callback){
		if (debug) console.log("Starting Triage for " + amazonUrl);
		// alert("Ready?");
		var fsc = fakespotCache.get(amazonUrl);
		if (fsc == null) {
			fsc = {
				"amazonUrl"         : amazonUrl,
				"productUrl"        : "",
				"productId"         : "",
				"ETag"              : "",
				"status"            : amazonfs.StatusEnum.NONE,
				"analysisPercent"   : 0,
				"analysisNotes"     : "",
				"productGrade"      : "?",
				"productName"       : "",
				"companyGrade"      : "?",
				"companyName"       : "",
				"companyGradeUrl"   : null,
				"analysisAge"       : "new",
				"twStarsUrl"        : null,
				"twStars"           : -1
				};
			fakespotCache.set(amazonUrl, fsc);
		}
		switch(fsc.status){
			case amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION:
				if (debug) console.log("Cached Status:WAITING_FOR_PAGE_GENERATION");
				amazonfs.waitForPageGeneration(fsc, callback);
				break;
			case amazonfs.StatusEnum.ANALYZING:
				if (debug) console.log("Cached Status:ANALYZING");
				amazonfs.getAnalysisPercent(fsc, callback);
				break;
			case amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS:
				if (debug) console.log("Cached Status:NOT_ENOUGH_REVIEWS");
				callback(fsc);
				break;
			case amazonfs.StatusEnum.DONE:
				console.log("Cached - Skipping everything, and sending back " + fsc.productGrade + " - " + fsc.companyGrade);
				callback(fsc);
				break;
			case amazonfs.StatusEnum.BAD:
				if (debug) console.log("Cached Status:BAD - Starting Over");
			case amazonfs.StatusEnum.NONE:
			default:
				amazonfs.getPageHome(fsc, callback);
				break;
		}
		return true;
	};
	
	/**
	 * Gets X-CSRF-Token to be used in future query (from fakespot.com/)
	 * Step 1 of FakeSpot
	 * */
	amazonfs.getPageHome = function(fsc, callback){
		if (debug) console.log("Starting Step 1 for " + fsc.amazonUrl);
		var xhttp = new XMLHttpRequest();

		xhttp.onload = function() {
			if (debug) console.log("Got status: " + xhttp.status);
			if (debug) console.log("Got readyState: " + xhttp.readyState);
			// if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){
				var csrfToken = "";
				var myRe = /meta\s+name="csrf-token"\s+content="([^"]+)"/;
				var result = myRe.exec(xhttp.responseText);
				if (result.length > 1){
					csrfToken = result[1];
				}
				
				if (csrfToken != ""){
					fsc.csrfToken = csrfToken;
					amazonfs.analyzeUrlForProductPage(fsc, callback);
				} else {
					console.error("Quitting1 amazonfs.getPageHome (metaslength:"+metas.length+")");
					fsc.status = amazonfs.StatusEnum.BAD;
					callback(fsc);
				}
			} else {
				console.error("Quitting2 amazonfs.getPageHome");
				fsc.status = amazonfs.StatusEnum.BAD;
				callback(fsc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status1: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			fsc.status = amazonfs.StatusEnum.BAD;
			callback(fsc);
		};
		xhttp.open('GET', 'https://www.fakespot.com', true);
		// setRequestHeader must be called *after* open
		xhttp.setRequestHeader('Accept', '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript');
		xhttp.withCredentials = true;
		xhttp.send();
		return true;
	};

	/**
	 * Gets the product page URL (from fakespot.com/analyze)
	 * Step 2 of FakeSpot
	 * */
	amazonfs.analyzeUrlForProductPage = function(fsc, callback){
		if (debug) console.log("Starting Step 2 for " + fsc.amazonUrl + " Token: " + fsc.csrfToken);
		var xhttp = new XMLHttpRequest();

		xhttp.onload = function() {
			if (debug) console.log("Got status: " + xhttp.status);
			if (debug) console.log("Got readyState: " + xhttp.readyState);
			if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){
				var myRe = /window.location = '(.*)'/;
				var result = myRe.exec(xhttp.responseText);
				if (debug) console.log("Found product as: " + result);
				if (result != null && result.length > 1){
					var productUrl = "https://www.fakespot.com" + result[1];
					// Update Cache
					fsc.productUrl = productUrl;
					amazonfs.getProductPage(fsc, callback);
					return true;
				}
				
				// The page could be telling us we are getting redirected
				myRe = /You are being.*fakespot.com(\/product\/[^"]+)">redirected/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 1){
					var productUrl = "https://www.fakespot.com" + result[1];
					fsc.productUrl = productUrl;
					if (debug) console.log("Found product ID as: " + productId);
					amazonfs.waitForPageGeneration(fsc, callback);
					return;
				}
				
				// The page could be telling us "not enough reviews"
				myRe = /Not enough reviews for analysis/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null){
					fsc.status = amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS;
					if (debug) console.log("Not enough reviews");
					callback(fsc);
					return;
				}
				
				// This Product could be new
				// So we didn't see a window redirect with product URL, let's try status updates
				myRe = /frm-result-(\w+)/;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 1){
					var productId = result[1];
					fsc.productId = productId;
					fsc.status = amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION;
					if (debug) console.log("Found product ID as: " + fsc.productId);
					amazonfs.waitForPageGeneration(fsc, callback);
					return;
				}
				console.error("Quitting1 amazonfs.analyzeUrlForProductPage");
				fsc.status = amazonfs.StatusEnum.BAD;
				callback(fsc);
			} else {
				console.error("Quitting2 amazonfs.analyzeUrlForProductPage");
				fsc.status = amazonfs.StatusEnum.BAD;
				callback(fsc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status2: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			fsc.status = amazonfs.StatusEnum.BAD;
			callback(fsc);
		};
		// https://fakespot.com/analyze?utf8=%E2%9C%93&url=https%3A%2F%2Fwww.amazon.com%2Fgp%2Fproduct%2FB00TSUGXKE&commit=Analyze
		// https://www.fakespot.com//analyze?utf8=%E2%9C%93&form_type=home_page&url=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB08BHN46G3&button=
		fsc.productUrl = 'https://www.fakespot.com/analyze?utf8=%E2%9C%93&form_type=home_page&url=' + encodeURIComponent(fsc.amazonUrl) + '&button=';
		xhttp.open('GET', fsc.productUrl, true);
		// setRequestHeader must be called *after* open
		xhttp.setRequestHeader('Accept', '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript');
		xhttp.setRequestHeader('X-CSRF-Token', fsc.csrfToken);
		xhttp.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		var formData = new FormData();
		formData.append("utf8", "✓");
		formData.append("url", fsc.amazonUrl);
		formData.append("commit", "Analyze");
		xhttp.withCredentials = true;
		// if (debug) console.log("going for request: " + );
		// alert('test');
		xhttp.send(formData);
		return true;
	};

	/**
	 * Waits for the product page to be created
	 * Step 2b of FakeSpot
	 * */
	amazonfs.waitForPageGeneration = function(fsc, callback){
		if (debug) console.log("Starting Step 2b for " + fsc.amazonUrl + " productId: " + fsc.productId);
		var xhttp = new XMLHttpRequest();

		xhttp.onload = function() {
			if (debug) console.log("Got status: " + xhttp.status);
			if (debug) console.log("Got readyState: " + xhttp.readyState);
			if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){
				var eTag = xhttp.getResponseHeader("ETag");
				fsc.ETag = eTag;
				
				var myRe = /"status":"OK"/i;
				var result = myRe.exec(xhttp.responseText);
				if (result != null){
					if (debug) console.log("Saw status of: " + result);
					amazonfs.analyzeUrlForProductPage(fsc, callback);
					return;
				}
				
				myRe = /Not enough reviews for analysis/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null){
					fsc.status = amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS;
					if (debug) console.log("Not enough reviews");
					callback(fsc);
					return;
				}
				
				fsc.status = amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION;
				// The page is still being generated, so just return
				callback(fsc);
			} else if (xhttp.status == 304){
				fsc.status = amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION;
				if (debug) console.warn("Page Generation got 304");
				callback(fsc);
			} else {
				fsc.status = amazonfs.StatusEnum.BAD;
				console.error("Quitting2 amazonfs.waitForPageGeneration");
				callback(fsc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status4: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			fsc.status = amazonfs.StatusEnum.BAD;
			callback(fsc);
		};
		xhttp.open('GET', 'https://www.fakespot.com/product_status/' + fsc.productId, true);
		// setRequestHeader must be called *after* open
		if (fsc.ETag != ""){
			xhttp.setRequestHeader('If-None-Match', fsc.ETag);
		}
		xhttp.setRequestHeader('X-CSRF-Token', fsc.csrfToken);
		xhttp.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhttp.setRequestHeader('Upgrade-Insecure-Requests', '1');
		xhttp.setRequestHeader('Accept', '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript');
		xhttp.withCredentials = true;
		xhttp.send();
		return true;
	};

	/**
	 * Convert all ascii chars to string
	 * https://stackoverflow.com/a/528786/277601
	 * */
	function RemoveASCIICodes(str){
		return str.replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(n); });
	}
	
	/**
	 * Gets the current analysis %
	 * */
	amazonfs.getAnalysisPercent = function(fsc, callback){
		if (debug) console.log("Starting AnalysisPercent for " + fsc.amazonUrl + " productId: " + fsc.productId);
		var xhttp = new XMLHttpRequest();

		xhttp.onload = function() {
			if (debug) console.log("Got status: " + xhttp.status);
			if (debug) console.log("Got readyState: " + xhttp.readyState);
			if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){
				var eTag = xhttp.getResponseHeader("ETag");
				fsc.ETag = eTag;
				
				// Get the 'analysisNotes'
				var myRe = /"status":"([^"]+)"/i;
				var result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 1){
					fsc.analysisNotes = result[1];
					fsc.analysisNotes = RemoveASCIICodes(fsc.analysisNotes);
				}
				
				// The page could be telling us we are getting redirected
				myRe = myRe = /"percent_done":"([^"]+)%"/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 1){
					fsc.analysisPercent = parseFloat(result[1]);
				}
				
				if (fsc.analysisPercent >= 100){
					if (debug) console.log("Analysis is now 100%, so calling ProductPage");
					amazonfs.getProductPage(fsc, callback);
					return;
				}
				if (debug) console.log("Analysis at " + fsc.analysisPercent + "% - " + fsc.analysisNotes);
				
				// The product is still being generated
				callback(fsc);
			} else if (xhttp.status == 304){
				// No Change
				if (debug) console.warn("Page Generation got 304");
				callback(fsc);
			} else {
				fsc.status = amazonfs.StatusEnum.BAD;
				console.error("Quitting2 amazonfs.waitForPageGeneration");
				callback(fsc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status4: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			callback(fsc);
		};
		var analysis_percent_url = 'https://www.fakespot.com/analysis_status/' + fsc.productId;
		if (debug) console.log("Analysis Percent URL: " + analysis_percent_url);
		xhttp.open('GET', analysis_percent_url, true);
		xhttp.setRequestHeader('X-CSRF-Token', fsc.csrfToken);
		xhttp.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhttp.setRequestHeader('Upgrade-Insecure-Requests', '1');
		xhttp.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
		xhttp.withCredentials = true;
		xhttp.send();
		return true;
	};

	/**
	 * Gets the product page to display
	 * Step 3 of FakeSpot
	 * */
	amazonfs.getProductPage = function(fsc, callback){
		if (debug) console.log("Starting Step 3 for " + fsc.amazonUrl + " ProductURL: " + fsc.productUrl);
		var xhttp = new XMLHttpRequest();

		xhttp.onload = function() {
			if (debug) console.log("Got status: " + xhttp.status);
			if (debug) console.log("Got readyState: " + xhttp.readyState);
			if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){
				if (debug) console.log("Finished getting product page");
				var myCompGradeLineRe = /"company-grade-box[^"]+grade-([abcdfu])[^"]*"/i;
				var resultCompGradeLine = myCompGradeLineRe.exec(xhttp.responseText);
				if (resultCompGradeLine != null && resultCompGradeLine.length > 1){
					if (debug) console.log("Found resultCompGrade: " + resultCompGradeLine);
					fsc.companyGrade = resultCompGradeLine[1] === 'u' ? "?" : resultCompGradeLine[1];
				}

				var myProdGradeLineRe = /"grade-box[^"]+grade-([abcdfu])[^"]*"/i;
				var resultProdGradeLine = myProdGradeLineRe.exec(xhttp.responseText);
				if (resultProdGradeLine != null && resultProdGradeLine.length > 1){
					if (debug) console.log("Found resultProdGrade: " + resultProdGradeLine);
					fsc.productGrade = resultProdGradeLine[1] === 'u' ? "?" : resultProdGradeLine[1];
				}
				
				// class="star-rating" ... rating="2.1"
				var myTWStarRe = /class="star-rating[^>]+\srating="([^"]+)"/i;
				var resultTWStar = myTWStarRe.exec(xhttp.responseText);
				if (resultTWStar != null && resultTWStar.length > 1){
					var myTWStar = parseFloat(resultTWStar[1]);
					fsc.twStars = myTWStar;
				}
				
				// itemprop="name">General Hydroponics GH1514 Ph Control Kit</span>
				var myProductNameRe = /itemprop="name">([^<]+)/i;
				var resultProductName = myProductNameRe.exec(xhttp.responseText);
				if (resultProductName != null && resultProductName.length > 1){
					if (debug) console.log("Found productName: " + resultProductName);
					fsc.productName = resultProductName[1];
					fsc.productName = RemoveASCIICodes(fsc.productName);
				}
				
				// https://trustwerty.com/product/
				var myTwStarsUrl = /(https:\/\/trustwerty.com\/product[^"]+)/i;
				var resultTwStarsUrl = myTwStarsUrl.exec(xhttp.responseText);
				if (resultTwStarsUrl != null && resultTwStarsUrl.length > 1){
					if (debug) console.log("Found twStarsUrl: " + resultTwStarsUrl);
					fsc.twStarsUrl = resultTwStarsUrl[1];
				}
				
				// company-label">Sold by&nbsp;<a class="link-highlight" href="/company/general-hydroponics">General Hydroponics</a>
				var myCompanyNameRe = /merchant-info">Sold by[^<]+<[^>]+href="(\/company\/[^"]+)">([^<]+)/i;
				var resultCompanyName = myCompanyNameRe.exec(xhttp.responseText);
				if (resultCompanyName != null && resultCompanyName.length > 2){
					if (debug) console.log("Found companyName: " + resultCompanyName);
					fsc.companyGradeUrl = 'https://www.fakespot.com' + resultCompanyName[1];
					fsc.companyName = resultCompanyName[2];
					fsc.companyName = RemoveASCIICodes(fsc.companyName);
				}
				
				var myAnalysisAgeRe = /reanalyze-analysis-msg/i;
				var resultAnalysisAge = myAnalysisAgeRe.exec(xhttp.responseText);
				if (resultAnalysisAge != null){
					fsc.analysisAge = "old";
				}
				
				// Get any updated ProductId (Different from the productId used for page generation)
				myRe = /id="frm-result-amazon-(\w+)/;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 1){
					var productId = result[1];
					fsc.productId = productId;
				}
				
				console.log("Sending back: " + fsc.productGrade + " - " + fsc.companyGrade + " - " + fsc.twStars);
				// Update Cache
				if (fsc.analysisPercent >= 100) {
					fsc.status = amazonfs.StatusEnum.DONE;
				} else {
					fsc.status = fsc.productGrade == "?" ? amazonfs.StatusEnum.ANALYZING : amazonfs.StatusEnum.DONE;
					fsc.analysisPercent = fsc.productGrade == "?" ? 0 : 100;
				}
				fsc.analysisNotes   = "From Fakespot.com";
				if (debug) console.log('  ^--> status: ' + fsc.status + ', percent: ' + fsc.analysisPercent + ', notes: ' + fsc.analysisNotes);
				callback(fsc);
			} else {
				fsc.status = amazonfs.StatusEnum.BAD;
				console.error("Quitting2 amazonfs.getProductPage");
				callback(fsc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status3: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			fsc.status = amazonfs.StatusEnum.BAD;
			callback(fsc);
		};
		xhttp.open('GET', fsc.productUrl, true);
		// setRequestHeader must be called *after* open
		xhttp.setRequestHeader('Upgrade-Insecure-Requests', '1');
		xhttp.setRequestHeader('Accept', '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript');
		xhttp.withCredentials = true;
		xhttp.send();
		return true;
	};

	// Close namespace amazonfs (https://stackoverflow.com/a/5947280/277601)
} ( window.amazonfs = window.amazonfs || {}, jQuery ));

