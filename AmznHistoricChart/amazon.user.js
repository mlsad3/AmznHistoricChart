// ==UserScript==
// @name           Historic Price Shopper
// ==/UserScript==

http://stackoverflow.com/a/5947280/277601
(function(amznhc, $, undefined) {

	// http://stackoverflow.com/a/24649134/277601
	// Avoid recursive frame insertion...
	// var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
	// if (!location.ancestorOrigins.contains(extensionOrigin)) {
	// 	pingForFakespotData();
	// }

	/** Get latest details from Fakespot
	 *   Status will be:
	 *     NONE - Ping again in 3 seconds
	 *     BAD - Do not continue
	 *     WAITING_FOR_PAGE_GENERATION - Ping again in 3 seconds
	 *     ANALYZING - Ping again in 3 seconds
	 *     NOT_ENOUGH_REVIEWS - Do not continue
	 *     DONE - Do not continue, should have product/company grade and Trustwerty rating
	 * */
	function pingForFakespotData(){
		chrome.runtime.sendMessage({
			method: 'GET',
			action: 'fakespot_xhttp',
			url: "https://" + window.location.hostname + window.location.pathname
		}, function(result) {
			console.log("Got fakespot data back: " + result.productGrade + " - " + result.companyGrade + " - " + result.twStars);
			console.log("   Returned status: " + result.status);
			
			switch(result.status){
				case amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION:
					console.log("Status:WAITING_FOR_PAGE_GENERATION");
					UpdateFakespotDetails(result);
					// Wait 3 seconds
					setTimeout(pingForFakespotData, 3000);
					break;
				case amazonfs.StatusEnum.ANALYZING:
					console.log("Status:ANALYZING - " + result.analysisPercent + "%  " + result.analysisNotes);
					UpdateFakespotDetails(result);
					// Wait 3 seconds
					setTimeout(pingForFakespotData, 3000);
					break;
				case amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS:
					console.log("Status:NOT_ENOUGH_REVIEWS");
					UpdateFakespotDetails(result);
					break;
				case amazonfs.StatusEnum.DONE:
					console.log("Status:DONE " + result.productGrade + " - " + result.companyGrade +
						" - " + result.twStars + " - AGE: " + result.analysisAge);
					UpdateFakespotDetails(result);
					break;
				case amazonfs.StatusEnum.BAD:
					console.log("Status:BAD");
					break;
				case amazonfs.StatusEnum.NONE:
				default:
					// Wait 3 seconds
					setTimeout(pingForFakespotData, 3000);
					break;
			}
		});
	}

	function isAlreadyAdded(elementName){
	  var element = document.getElementById(elementName);
	  return element != null;
	}

	function removeElement(elementName) {
	  var element = document.getElementById(elementName);
	  if (element && element.parentElement)
		element.parentElement.removeChild(element);
	}

	function removeElementList(elementName) {
	  var list = document.getElementByClassName(elementName);
	  for (var i = list.length - 1; 0 <= i; i--)
		if(list[i] && list[i].parentElement)
		  list[i].parentElement.removeChild(list[i]);
	}

	var nwtcr_domAdditionsCount = 0;
	/**
	 * Waits until DOM changes have stopped before adding our modifications to the website.
	 * When user changes product size/color/variant, parts of the page get deleted or recreated.
	 * For this case, we wait until all changes have finished, then try adding our modifications
	 * back in.
	 *  - Wait some more if changes have happened recently
	 *  - Wait some more if, after trying to add our modifications, they do not exist anymore
	 * */
	function onDomChange2(){
		if (nwtcr_domAdditionsCount > 0){
			nwtcr_domAdditionsCount = 0;
			setTimeout(function(){onDomChange2();}, 500);	
		} else {
			amznhc.addAmazonPriceGraph();
			if (isAlreadyAdded('MyMiniCamelChart')){
				document.documentElement.removeEventListener('DOMNodeInsertedIntoDocument', countDocAdditions, false);
			} else {
				setTimeout(function(){onDomChange2();}, 1000);	
			}
		}
	};

	/**
	 * Counts number of times nodes have been inserted into the document.
	 * We are tracking this because we don't want to add our charts back in while page
	 * is still getting created.
	 * */
	function countDocAdditions(){
		nwtcr_domAdditionsCount += 1;
	};

	/**
	 * When the CamelCamelCamel's ancestor node is removed from page, cleanup and remove 
	 * all modifications we've made (makes it easier when adding them back in).
	 * It is also important to get new images since the same product with a different
	 * color/size will have a different CamelCamelCamel chart.
	 * */
	function onCamelRemove(){ 
		var element = document.getElementById('MyMiniCamelChart');
		if (element != null) {
			element.id = 'MyMiniCamelChartRemoved';
		}
		removeElement('MyCamelChart');
		removeElement('MyMiniCamelChart');
		removeElement('MyCamelSalesRankChart');
		removeElement('MyFakespotReport');
		removeElement('MyTWStarsUpdate'); // TODO: Add MyTWStarsUpdate
		nwtcr_domAdditionsCount = 0;
		
		document.documentElement.addEventListener('DOMNodeInsertedIntoDocument', countDocAdditions, false);
		setTimeout(function(){onDomChange2();}, 500);	
	};

	function pingForCamelImage(nodeId, camelUrl){
		chrome.runtime.sendMessage({
			action: 'camelimage_xhttp',
			url: camelUrl
		}, function(result) {
			var node = document.getElementById(nodeId);
			if (node != null && result != null) {
				node.src = result; //window.URL.createObjectURL(result);
				node.setAttribute('style', 'visibility:visible');
			}
		});
	}

	/**
	 * Grabs location to put new node
	 * Returns Hash:
	 *   - found                : Bool - If location for new node was found
	 *   - element              : Element - Location to insert new node into
	 *   - siblingToPlaceBefore : Element - Child of element that item should be placed before (unless 'null')
	 * */
	function getElementAndSibling(domNodeOptions){
		var result = {
			"found"                : false,
			"element"              : null,
			"siblingToPlaceBefore" : null
		};
		if (domNodeOptions.getBy == "id") {
			result.element = document.getElementById(domNodeOptions.parentId);
		} else if (domNodeOptions.getBy == "class") {
			var elements = document.getElementsByClassName(domNodeOptions.parentId);
			if (elements.length == 0) return result;
			result.element = elements[0];
		} else if (domNodeOptions.getBy == "tag") {
			var elements = document.getElementsByTagName(domNodeOptions.parentId);
			if (elements.length == 0) return result;
			result.element = elements[0];
		}
		if (result.element == null) return result;
		if (domNodeOptions.afterSiblingNotAsChild) {
			result.siblingToPlaceBefore = result.element.nextSibling;
			if (result.element != null) 
				result.element = result.element.parentNode;
			if (result.element == null) return result;
		} else {
			result.siblingToPlaceBefore = result.element.firstChild;
		}
		result.found = true;
		return result;
	}
	
	/**
	 * Adds CamelCamelCamel image (linking to CamelCamelCamel).
	 * Also adds listener, DOMNodeRemovedFromDocument, as the AddToCart gets regenerated whenever
	 * customer selects a different color/size/variant within the same product. When this happens,
	 * our modifications get removed, so we wait for a delay following the removal, and add them
	 * back in.
	 * */
	function addLinkImg(details, domNodeOptions) {
	  var domLoc = getElementAndSibling(domNodeOptions);
	  if (!domLoc.found) return false;

	  var div = document.createElement('div');
	  div.setAttribute('id', details.nodeName);
	  div.setAttribute('style', 'border-radius: 5px;padding: 6px;box-shadow: rgba(0, 120, 0, 0.2) 1px 2px 2px 0px; margin-bottom: 4px;');
	  
	  var label = document.createElement('a');
	  label.setAttribute('class', 'nav_a');
	  label.setAttribute('href', details.imgLink);
	  label.setAttribute('rel', 'noreferrer');
	  label.setAttribute('style', 'line-height:12px');
	  
	  var img = document.createElement('img');
	  label.appendChild(img);
	  var imgId = details.nodeName+"_img";
	  img.setAttribute('id', imgId);
	  // Set image to 1x1 blank pixel for now
	  img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==');
	  img.setAttribute('alt', details.imgTitle); // Alt if image does not exist
	  img.setAttribute('title', details.imgTitle); // Title should make hover text
	  img.setAttribute('width', details.imgWidth);
	  img.setAttribute('height', details.imgHeight);
	  img.setAttribute('style', 'visibility:hidden');

	  if (domNodeOptions.addTitle) {
		  var span = document.createElement('span');
		  span.setAttribute('style', 'font-size : large; color : #9933ff;');
		  var txt = document.createTextNode(details.imgTitle);
		  span.appendChild(txt);

		  div.appendChild(span);
		  div.appendChild(document.createElement('br'));
	  }
	  div.appendChild(label);
	  div.appendChild(document.createElement('br'));
	  
	  if (details.linkText != null){
		  var spanLink = document.createElement('span');
		  spanLink.setAttribute('style', 'font-size : x-small');
		  var txt = document.createTextNode(details.linkText);
		  spanLink.appendChild(txt);

		  label = document.createElement('a');
		  label.setAttribute('class', 'nav_a');
		  label.setAttribute('href', details.linkLink);
		  label.setAttribute('rel', 'noreferrer');
		  label.setAttribute('style', 'line-height:12px');
		  label.appendChild(spanLink);
		  
		  div.appendChild(label);
	  }
	  
	  //div.appendChild(document.createElement('br'));
	  //console.log("found " + domNodeOptions.parentId);
	  domLoc.element.insertBefore(div, domLoc.siblingToPlaceBefore);
	  pingForCamelImage(imgId, details.imgSrc);
	  if (domNodeOptions.addListener) div.addEventListener('DOMNodeRemovedFromDocument', onCamelRemove, false);

	  return true;
	}

	/**
	 * Returns the color for a given Fakespot Grade
	 * */
	function getFakespotGradeColor(grade){
		return (grade == "a") ? "#7ED321" :
		       (grade == "b") ? "#3b93e3" :
		       (grade == "c") ? "#ffb100" :
		       (grade == "d") ? "#ffb100" :
		       (grade == "f") ? "#8B0000" :
		       (grade == "?") ? "#e2e2e2" :
		       "#c2c2c2";
	}
	
	/**
	 * Adds Fakespot Grade Report and link to Fakespot product page.
	 * */
	function addFakespotReport(results, domNodeOptions) {
		// url, imgUrl, imgTitle, divName
	  var domLoc = getElementAndSibling(domNodeOptions);
	  if (!domLoc.found) return false;

	  var fsDiv = document.createElement('div');
	  fsDiv.setAttribute('id', "MyFakespotReport");
	  fsDiv.setAttribute('style', 'text-decoration: none; color: rgb(94, 170, 241); font-weight: 500; text-align: center; border-radius: 5px; box-shadow: rgba(0, 120, 0, 0.2) 1px 2px 2px 0px; background-color: rgb(255, 255, 255); position: relative; margin-bottom: 4px;padding:4px');
	  domLoc.element.insertBefore(fsDiv, domLoc.siblingToPlaceBefore);
	  UpdateFakespotDetails(results);
	  return true;
	}
	
	/**
	 * Finds current Fakespot Report and replaces it with up-to-date values
	 * */
	function UpdateFakespotDetails(results){
	  var fsDiv = document.getElementById("MyFakespotReport");
	  if (fsDiv == null) return;
	  
	  // Delete everything inside
	  while (fsDiv.firstChild)
		  fsDiv.removeChild(fsDiv.firstChild);
	  
	  var table = document.createElement('table');
	  fsDiv.appendChild(table);
	  var tbody = document.createElement('tbody');
	  table.appendChild(tbody);
	  
	  //// Fakespot(tm) Grade
	  var tr, td, div, txt, span, color, hoverText;
	  tr = document.createElement('tr');
	  tbody.appendChild(tr);
	  tr.setAttribute('style', 'padding:0px;margin-bottom:0px;');
	  td = document.createElement('td');
	  tr.appendChild(td);
	  td.setAttribute('colspan', '3');
	  td.setAttribute('style', 'padding:0px;margin-bottom:0px;');
	  div = document.createElement('div');
	  td.appendChild(div);
	  div.setAttribute('style', 'font-size:11px;line-height:11px;font-weight:700;color:#145d73;text-decoration:none;');
	  txt = document.createTextNode("Fake");
	  div.appendChild(txt);
	  span = document.createElement("span");
	  div.appendChild(span);
	  txt = document.createTextNode("spot™ Grade");
	  span.appendChild(txt);
	  span.setAttribute('style', 'color:#63b0f4');

	//	switch(results.status){
	//		case amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION:
	//			break;
	//		case amazonfs.StatusEnum.ANALYZING:
	//			break;
	//		case amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS:
	//			break;
	//		case amazonfs.StatusEnum.DONE:
	//			break;
	//		default:
	//			// Do nothing
	//			break;
	//	}

	  tr = document.createElement('tr');
	  tbody.appendChild(tr);
	  
	  //// Product Grade
	  td = document.createElement('td');
	  tr.appendChild(td);
	  if (results.status == amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION){
		  hoverText = "This is a product that Fakespot has not analyzed yet.\r\n" +
		              "Please wait while analysis happens or click to\r\n" +
					  "visit Fakespot.com for a detailed report.";
	  } else if (results.status == amazonfs.StatusEnum.ANALYZING){
		  hoverText = "Fakespot is analyzing this product's comments\r\n" +
		              "\tStatus: " + results.analysisPercent + "% complete.\r\n" +
		              "\t" + results.analysisNotes + "\r\n\r\n" +
					  "Visit Fakespot.com for a detailed report!";
	  } else if (results.status == amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS){
		  hoverText = "This product does not have enough reviews for\r\n" +
		              "Fakespot to analyze.";
	  } else {
		  hoverText = "Product: " + results.productName + "\r\n\r\n" +
		              "\tThis product's reviews got a trustworthiness\r\n" +
					  "\tgrade of '" + results.productGrade.toUpperCase() + "' based on an analysis by\r\n" +
		              "\tFakespot.com.\r\n" +
		              "\ti.e. \"Are there a lot of fake reviews?\"\r\n\r\n" +
					  "Visit Fakespot.com for a detailed report!";
	  }
	  td.setAttribute('title', hoverText);
	  if (results.productUrl != null){
		  td.setAttribute('onclick', "window.open('" + results.productUrl + "')");
		  td.setAttribute('style', 'cursor: pointer;width:30%;');
	  } else {
		  td.setAttribute('style', 'width:30%;');
	  }
	  div = document.createElement('div');
	  td.appendChild(div);
	  color = getFakespotGradeColor(results.productGrade);
	  div.setAttribute('style', 'border:1px solid ' + color + ';border-radius: 5px;color:' + color + ';background-color:#FFFFFF;font-size:22px;line-height:25px;font-weight:700;text-decoration:none;');
	  txt = document.createTextNode(results.productGrade.toUpperCase());
	  div.appendChild(txt);
	  div = document.createElement('div');
	  td.appendChild(div);
	  div.setAttribute('style', 'font-weight:400;font-size:10px;line-height:12px;text-decoration:none;');
	  txt = document.createTextNode("Product");
	  div.appendChild(txt);
	  
	  //// Company Grade
	  td = document.createElement('td');
	  tr.appendChild(td);
	  if (results.status == amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION){
		  hoverText = "This is a company Fakespot has not analyzed yet.\r\n" +
		              "Please wait while analysis happens or click to\r\n" +
					  "visit Fakespot.com for a detailed report.";
	  } else if (results.status == amazonfs.StatusEnum.ANALYZING){
		  hoverText = "Fakespot is analyzing this product's comments\r\n" +
		              "\tStatus: " + results.analysisPercent + "% complete.\r\n" +
		              "\t" + results.analysisNotes + "\r\n\r\n" +
					  "Visit Fakespot.com for a detailed report!";
	  } else if (results.status == amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS){
		  hoverText = "This company's product does not have enough reviews\r\n" +
		              "for Fakespot to analyze.";
	  } else {
		  hoverText = "Company: " + results.companyName + "\r\n\r\n" +
		              "\tThis company got a '" + results.companyGrade.toUpperCase() + "' grade based on the\r\n" +
		              "\ttrustability of all of its products' comments.\r\n" +
		              "\ti.e. \"Is the company funding a lot of fake reviews?\"\r\n\r\n" +
					  "Visit Fakespot.com for a detailed report on this company!";
	  }
	  td.setAttribute('title', hoverText);
	  if (results.companyGradeUrl != null){
		  td.setAttribute('onclick', "window.open('" + results.companyGradeUrl + "')");
		  td.setAttribute('style', 'cursor: pointer;width:30%;');
	  } else {
		  td.setAttribute('style', 'width:30%;');
	  }
	  div = document.createElement('div');
	  td.appendChild(div);
	  color = getFakespotGradeColor(results.companyGrade);
	  div.setAttribute('style', 'border:1px solid ' + color + ';border-radius: 5px;color:' + color + ';background-color:#FFFFFF;font-size:22px;line-height:25px;font-weight:700;text-decoration:none;');
	  txt = document.createTextNode(results.companyGrade.toUpperCase());
	  div.appendChild(txt);
	  div = document.createElement('div');
	  td.appendChild(div);
	  div.setAttribute('style', 'font-weight:400;font-size:10px;line-height:12px;text-decoration:none;');
	  txt = document.createTextNode("Company");
	  div.appendChild(txt);
	  
	  //// Trustwerty - I'm not sure if every product has a score. It seems like I've seen some without.
	  if (results.twStars >0){
		  td = document.createElement('td');
		  tr.appendChild(td);
		  if (results.status == amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION){
			  hoverText = "This is a company Fakespot has not analyzed yet.\r\n" +
						  "Please wait while analysis happens or click to\r\n" +
						  "visit Fakespot.com for a detailed report.";
		  } else if (results.status == amazonfs.StatusEnum.ANALYZING){
			  hoverText = "Fakespot is analyzing this product's comments\r\n" +
						  "\tStatus: " + results.analysisPercent + "% complete.\r\n" +
						  "\t" + results.analysisNotes + "\r\n\r\n" +
						  "Visit Fakespot.com for a detailed report!";
		  } else if (results.status == amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS){
			  hoverText = "This company's product does not have enough reviews\r\n" +
						  "for Fakespot or Trustwerty to analyze.";
		  } else {
			  hoverText = "Product: " + results.productName + "\r\n\r\n" +
						  "\tAfter removing the suspicious reviews, Trustwerty\r\n" +
						  "\trecalculated the reviews to be " + results.twStars + " stars.\r\n\r\n" +
						  "Visit Trustwerty.com for a detailed report of the comments!";
		  }
		  td.setAttribute('title', hoverText);
		  if (results.twStarsUrl != null){
			  td.setAttribute('onclick', "window.open('" + results.twStarsUrl + "')");
			  td.setAttribute('style', 'cursor: pointer;width:40%;');
		  } else {
			  td.setAttribute('style', 'width:30%;');
		  }
		  div = document.createElement('div');
		  td.appendChild(div);
		  color = getFakespotGradeColor(results.companyGrade);
		  div.setAttribute('style', 'border:1px solid rgba(0,0,0,0);border-radius: 5px;font-size:20px;line-height:25px;font-weight:700;text-decoration:none;');
		  txt = document.createTextNode(results.twStars);
		  div.appendChild(txt);
		  span = document.createElement("span");
		  div.appendChild(span);
		  txt = document.createTextNode(" Stars");
		  span.appendChild(txt);
		  span.setAttribute('style', 'font-size:13px;');
		  div = document.createElement('div');
		  td.appendChild(div);
		  div.setAttribute('style', 'font-weight:400;font-size:10px;line-height:12px;color:#1560a1;text-decoration:none;');
		  txt = document.createTextNode("Trust");
		  div.appendChild(txt);
		  span = document.createElement("span");
		  div.appendChild(span);
		  txt = document.createTextNode("werty™");
		  span.appendChild(txt);
		  span.setAttribute('style', 'color:#64b5f6;');
	  }
	  
	  // var label = document.createElement('a');
	  // label.setAttribute('class', 'nav_a');
	  // label.setAttribute('href', url);
	  // label.setAttribute('rel', 'noreferrer');
	  // 
	  // var img = document.createElement('img');
	  // img.setAttribute('src', imgUrl);
	  // img.setAttribute('alt', imgTitle); // Alt if image does not exist
	  // img.setAttribute('title', imgTitle); // Title should make hover text
	  // img.setAttribute('width', width);
	  // img.setAttribute('height', height);
      // 
	  // if (domNodeOptions.addTitle) {
		 //  var span = document.createElement('span');
		 //  span.setAttribute('style', 'font-size : large; color : #9933ff;');
		 //  span.innerHTML = imgTitle;
      // 
		 //  fsDiv.appendChild(span);
		 //  fsDiv.appendChild(document.createElement('br'));
	  // }
	  // fsDiv.appendChild(label);
	  // fsDiv.appendChild(document.createElement('br'));
	  // fsDiv.appendChild(document.createElement('br'));
	  // label.appendChild(img);
	  //console.log("found " + domNodeOptions.parentId);
	  
	  return true;
	}

	/**
	 * Gets the product ASIN (i.e. B01MRZIY0P)
	 * It tries to find it by first searching for Id named ASIN or asin,
	 * and then it tries the current page's URL: http://.*amazon.com.*?\/([A-Z0-9]{10})\/
	 * */
	function getASIN() {
		var ASIN = "";
		var asinElement = document.getElementById('ASIN');
		var asinElement2 = document.getElementById('asin');
		if (asinElement != null && asinElement.value != null && asinElement.value != ""){
			ASIN = asinElement.value;
		} else if (asinElement2 != null && asinElement2.value != null && asinElement2.value != ""){
			ASIN = asinElement2.value;
		} else if ((m = window.location.href.match(/\/([A-Z0-9]{10})(?:[/?]|$)/)) != null) {
			// The ASIN was found
			ASIN = m[1];
		}
		return ASIN;
	}

	/**
	 * Adds CamelCamelCamel graph and Fakespot results to Amazon webpage.
	 * */
	amznhc.addAmazonPriceGraph = function() {
		// Check if it's already added:
		if (isAlreadyAdded('MyMiniCamelChart')) {return;}
		
		// Get current ASIN & domain
		var amzTLD = "", ASIN = "", amzPre = "www.", m;
		if ((m = window.location.href.match(/((?:[a-zA-Z0-9_]+\.)?)amazon\.([a-z\.]+)\//)) != null) {
			amzPre = m[1];
			amzTLD = m[2];
			if (amzTLD == "co.jp") amzTLD = "jp";
			if (amzTLD == "at") amzTLD = "de";
		}
		
		ASIN = getASIN();


		if (amzTLD != null && ASIN != null) {
			// Clicking on this link will provide a larger historical image inside the same Amazon window
			var strNewALink = encodeURI("http://" + amzPre + "amazon." + amzTLD + "/gp/product/" + ASIN + "/?ie=UTF8&showcamellargegraph=1");
			// After the larger historical price window (inside Amazon) is up, clicking on the image again will take you
			// to CamelCamelCamel.com
			var strCamelLink = encodeURI("http://camelcamelcamel.com/product/" + ASIN);
			var strCamelSalesRankLink = encodeURI("http://camelcamelcamel.com/product/" + ASIN + "?active=sales_rank");
			var imgSmallLoc = encodeURI("http://charts.camelcamelcamel.com/us/" + ASIN + "/amazon.png?force=1&zero=0&w=350&h=300&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en");
			var imgLargeLoc = encodeURI("http://charts.camelcamelcamel.com/us/" + ASIN + "/amazon.png?force=1&zero=0&w=500&h=400&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en");
			var imgLargeSalesRankLoc = encodeURI("http://charts.camelcamelcamel.com/us/" + ASIN + "/sales-rank.png?force=1&zero=0&w=500&h=250&legend=1&ilt=1&tp=all&fo=0&lang=en");

			/*	var domNodeOptionsForLargeSalesRankGraph = [];
			 *	domNodeOptionsForLargeSalesRankGraph.push(
			 *		{"afterSiblingNotAsChild":true,  "parentId":'title_feature_div',         "getBy":"id"},
			 *		{"afterSiblingNotAsChild":false, "parentId":'title_feature_div',         "getBy":"id"},
			 *		{"afterSiblingNotAsChild":false, "parentId":'product-title_feature_div', "getBy":"id"},
			 *		{"afterSiblingNotAsChild":false, "parentId":'title_row',                 "getBy":"id"},
			 *		{"afterSiblingNotAsChild":false, "parentId":'title',                     "getBy":"id"},
			 *		{"afterSiblingNotAsChild":false, "parentId":'parseasinTitle',            "getBy":"class"}
			 *		);
			 * */
			var domNodeOptionsForLargeCamelGraph = [];
			domNodeOptionsForLargeCamelGraph.push(
				{"afterSiblingNotAsChild":true,  "parentId":'title_feature_div',         "getBy":"id"},
				{"afterSiblingNotAsChild":false, "parentId":'title_feature_div',         "getBy":"id"},
				{"afterSiblingNotAsChild":false, "parentId":'product-title_feature_div', "getBy":"id"},
				{"afterSiblingNotAsChild":false, "parentId":'title_row',                 "getBy":"id"},
				{"afterSiblingNotAsChild":false, "parentId":'title',                     "getBy":"id"},
				{"afterSiblingNotAsChild":false, "parentId":'parseasinTitle',            "getBy":"class"}
				);
			var domNodeOptionsForMiniCamelGraph = [];
			domNodeOptionsForMiniCamelGraph.push(
				// Page example: Electric shavers (or deal of the day) (which was once http://www.amazon.com/gp/product/B003YJAZZ4 )
				//   This should NOT use buy-box_feature_div, since it doesn't seem to be created at the time the DOM is built :-/
				{"parentId":'buybox',              "getBy":"id"},
				{"parentId":'buy-box_feature_div', "getBy":"id"},
				{"parentId":'dmusic_buy_box',      "getBy":"id"},
				{"parentId":'buy',                 "getBy":"class"},
				{"parentId":'buying',              "getBy":"class"},
				//   These should be a last-check since it puts it in wrong spot for other pages like http://www.amazon.com/gp/product/B00U3FPN4U
				{"parentId":'price_feature_div',   "getBy":"id"},
				// Page example: Baby K'tan Original Baby Carrier amazon.com/dp/B00FSKX266
				{"parentId":'buybox_feature_div',  "getBy":"id"},
				{"parentId":'buybox',              "getBy":"data-feature-name"}
				);
			
			// Decide which link to add:
			var res;
			if ((m = window.location.href.match(new RegExp("\\&showcamellargegraph=1\\b"))) != null) {
				// Different sections of Amazon have different html, and so I need to
				// try to add the Historical Data to multiple locations (once one works, quit)
				
				// Note, the ordering is important in below, search in that priority
				// Page example: Electric shavers (which was once http://www.amazon.com/gp/product/B003YJAZZ4 )
				//    This should NOT use title_feature_div, since it has a css max-height:55px. Instead, put it at the same level but just AFTER
				
				/*	// Camel Historic Sales Rank graphs -- Do not enable until we add settings page
				 *	var camelSalesDetails = {
				 *		'imgLink'   : strCamelSalesRankLink,
				 *		'imgSrc'    : imgLargeSalesRankLoc,
				 *		'imgTitle'  : "Historical Sales Rank",
				 *		'imgWidth'  : 500,
				 *		'imgHeight' : 250,
				 *		'linkLink'  : null,
				 *		'linkText'  : null,
				 *		'nodeName'  : 'MyCamelSalesRankChart'
				 *	};
				 *	for (var i = 0; i < domNodeOptionsForLargeSalesRankGraph.length; i++){
				 *		domNodeOptionsForLargeSalesRankGraph[i].addListener = false;
				 *		domNodeOptionsForLargeSalesRankGraph[i].addTitle    = true;
				 *		// console.info("Camel Historic Sales Rank graphs - trying " + domNodeOptionsForLargeSalesRankGraph[i].parentId);
				 *		// Wait for settings page before adding sales rank
				 *		res = addLinkImg(camelSalesDetails, domNodeOptionsForLargeSalesRankGraph[i]);
				 *		if (res) break;
				 *	}
				 * */
				
				
				var camelLargeDetails = {
					'imgLink'   : strCamelLink,
					'imgSrc'    : imgLargeLoc,
					'imgTitle'  : "HistoricPriceShopper - Click to go to CamelCamelCamel",
					'imgWidth'  : 500,
					'imgHeight' : 400,
					'linkLink'  : null,
					'linkText'  : null,
					'nodeName'  : 'MyCamelChart'
				};
				// Camel Historic price graph
				for (var i = 0; i < domNodeOptionsForLargeCamelGraph.length; i++){
					domNodeOptionsForLargeCamelGraph[i].addListener = false;
					domNodeOptionsForLargeCamelGraph[i].addTitle    = false;
					// console.info("Camel Large Historic price graph - trying " + domNodeOptionsForLargeCamelGraph[i].parentId);
					res = addLinkImg(camelLargeDetails, domNodeOptionsForLargeCamelGraph[i]);
					if (res) break;
				}
			}

			var results = {
				"productUrl"        : "",
				"status"            : amazonfs.StatusEnum.NONE,
				"analysisPercent"   : 0,
				"analysisNotes"     : "",
				"productGrade"      : "?",
				"productGradeNotes" : null,
				"productName"       : "",
				"companyGrade"      : "?",
				"companyGradeNotes" : null,
				"companyName"       : "",
				"companyGradeUrl"   : null,
				"analysisAge"       : "new",
				"twStarsUrl"        : null,
				"twStars"           : -1
				};			// Add Fakespot results
			pingForFakespotData();
			for (var i = 0; i < domNodeOptionsForMiniCamelGraph.length; i++){
				// console.log("Got here for " + domNodeOptionsForMiniCamelGraph[i].parentId);
				res = addFakespotReport(results, domNodeOptionsForMiniCamelGraph[i]);
				if (res) break;
			}
			
			var camelDetails = {
				'imgLink'   : strNewALink,
				'imgSrc'    : imgSmallLoc,
				'imgTitle'  : "Click to see larger image - HistoricPriceShopper",
				'imgWidth'  : 175,
				'imgHeight' : 100,
				'linkLink'  : strCamelLink,
				'linkText'  : "Track at CamelCamelCamel",
				'nodeName'  : 'MyMiniCamelChart'
			};
			
			// Camel Historic price mini-graph
			for (var i = 0; i < domNodeOptionsForMiniCamelGraph.length; i++){
				domNodeOptionsForMiniCamelGraph[i].addListener            = true;
				domNodeOptionsForMiniCamelGraph[i].addTitle               = false;
				domNodeOptionsForMiniCamelGraph[i].afterSiblingNotAsChild = false;
				// console.info("Camel Historic price mini-graph - trying " + domNodeOptionsForMiniCamelGraph[i].parentId);
				res = addLinkImg(camelDetails, domNodeOptionsForMiniCamelGraph[i]);
				if (res) break;
			}
		} else {
			//console.log("Didn't find Amazon stuff");
		}
		
	}
	// Close namespace amznhc (http://stackoverflow.com/a/5947280/277601)
} ( window.amznhc = window.amznhc || {}, jQuery ));

amznhc.addAmazonPriceGraph();