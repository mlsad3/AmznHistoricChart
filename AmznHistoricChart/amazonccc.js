(function(amazonccc, $, undefined) {
	var debug = false;
	// Keep info on the last 100 Amazon products
	var cccCache = new LRUMap(100);
	
	amazonccc.StatusEnum = { 
		NONE : 0,
		BAD  : 1,
		DONE : 2
	}
	
	/**
	 * Decide what stage to skip to, based on cached values
	 * */
	amazonccc.triage = function(asin, callback){
		if (asin == null || asin == ""){
			callback(ccc);
			return true;
		}
		if (debug) console.log("Starting Triage for " + asin);
		// alert("Ready?");
		var ccc = cccCache.get(asin);
		if (ccc == null) {
			ccc = {
				"asin"              : asin,
				"camelUrl"          : "http://camelcamelcamel.com/product/" + asin,
				"productUrl"        : null,
				"status"            : amazonccc.StatusEnum.NONE,
				"graphAmazonURL"    : null,
				"graph3PNewURL"     : null,
				"graph3PUsedURL"    : null
				};
			cccCache.set(asin, ccc);
		}
		switch(ccc.status){
			case amazonccc.StatusEnum.DONE:
				callback(ccc);
				break;
			case amazonccc.StatusEnum.BAD:
				if (debug) console.log("Cached Status:BAD - Starting Over");
			case amazonccc.StatusEnum.NONE:
			default:
				amazonccc.getPageHome(ccc, callback);
				break;
		}
		return true;
	};
	
	/**
	 * Gets the redirect location for product
	 * */
	amazonccc.getPageHome = function(ccc, callback){
		if (debug) console.log("Starting Step 1 for " + ccc.camelUrl);
		var xhttp = new XMLHttpRequest();
		var url = ccc.productUrl != null ? ccc.productUrl : ccc.camelUrl;

		xhttp.onload = function() {
			//if (debug) console.log("Got status: " + xhttp.status);
			//if (debug) console.log("Got readyState: " + xhttp.readyState);
			//if (debug) console.log("Navigated to " + url);
			//if (debug) console.log("Got text: " + xhttp.responseText);
			if (xhttp.readyState == 4 && xhttp.status == 200){

				// The page may be telling us we are getting redirected
				// Prevent a redirect loop by checking if we already have the location (ccc.productUrl)
				var myRe = /You are being.*camelcamelcamel.com(\/[^"]+)">redirected/i;
				var result = myRe.exec(xhttp.responseText);
				if (ccc.productUrl == null && result != null && result.length > 1){
					var productUrl = "http://camelcamelcamel.com" + result[1];
					ccc.productUrl = productUrl;
					if (debug) console.log("Found product URL as: " + ccc.productUrl);
					amazonccc.getPageHome(ccc, callback);
					return;
				}
				
				// value="amazon" id="price_type_0" checked="checked" disabled="disabled"
				myRe = /value="amazon"\s*id="price_type_0"[^>]*>/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 0){
					var disabledRe = /disabled="disabled"/i;
					var isDisabledResult = disabledRe.exec(result[0]);
					if (isDisabledResult != null) {
						ccc.graphAmazonURL = null;
					} else {
						ccc.graphAmazonURL = "http://charts.camelcamelcamel.com/us/" + ccc.asin + "/amazon.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
					}
					if (debug) console.log("Found graphAmazonURL as: " + ccc.graphAmazonURL);
				} else {
					console.error("Quitting3 amazonccc.getPageHome Didn't find amazon");
					ccc.graphAmazonURL = null;
				}
				
				// value="new" id="price_type_1" checked="checked" disabled="disabled"
				myRe = /value="new"\s*id="price_type_1"[^>]*>/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 0){
					var disabledRe = /disabled="disabled"/i;
					var isDisabledResult = disabledRe.exec(result[0]);
					if (isDisabledResult != null) {
						ccc.graph3PNewURL = null;
					} else {
						ccc.graph3PNewURL = "http://charts.camelcamelcamel.com/us/" + ccc.asin + "/new.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
					}
					if (debug) console.log("Found graph3PNewURL as: " + ccc.graph3PNewURL);
				} else {
					console.error("Quitting4 amazonccc.getPageHome Didn't find new");
					ccc.graph3PNewURL = null;
				}
				
				// value="used" id="price_type_2" checked="checked" disabled="disabled"
				myRe = /value="used"\s*id="price_type_2"[^>]*>/i;
				result = myRe.exec(xhttp.responseText);
				if (result != null && result.length > 0){
					var disabledRe = /disabled="disabled"/i;
					var isDisabledResult = disabledRe.exec(result[0]);
					if (isDisabledResult != null) {
						ccc.graph3PUsedURL = null;
					} else {
						ccc.graph3PUsedURL = "http://charts.camelcamelcamel.com/us/" + ccc.asin + "/used.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
					}
					if (debug) console.log("Found graph3PUsedURL as: " + ccc.graph3PUsedURL);
				} else {
					console.error("Quitting5 amazonccc.getPageHome Didn't find old");
					ccc.graph3PUsedURL = null;
				}
				ccc.graphSalesRankURL = "http://charts.camelcamelcamel.com/us/" + ccc.asin + "/sales-rank.png?force=1&zero=0&legend=1&ilt=1&tp=all&fo=0&lang=en";
				if (debug) console.log("Found graphSalesRankURL as: " + ccc.graphSalesRankURL);
				
				ccc.status = amazonccc.StatusEnum.DONE;
				callback(ccc);
			} else {
				console.error("Quitting2 amazonccc.getPageHome");
				ccc.status = amazonccc.StatusEnum.BAD;
				callback(ccc);
			}
		};
		xhttp.onerror = function(e) {
			console.error("Error status1: " + e.target.status);
			// Do whatever you want on error. Don't forget to invoke the
			// callback to clean up the communication port.
			ccc.status = amazonccc.StatusEnum.BAD;
			callback(ccc);
		};
		xhttp.open('GET', url, true);
		// setRequestHeader must be called *after* open
		xhttp.setRequestHeader('Accept', '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript');
		xhttp.send();
		return true;
	};

} ( window.amazonccc = window.amazonccc || {}, jQuery ));

