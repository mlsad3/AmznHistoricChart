// ==UserScript==
// @name           Historic Price Shopper
// @namespace      AHC.newwarestech.com
// @description    Adds Amazon.com historical price graph above the AddToCart button so you can always know if it's a good time to buy.
// @icon           http://www.amazon.com/favicon.ico
// @include        http://www.amazon.*/*
// @include        http://amazon.*/*
// @version        0.16
// ==/UserScript==

//http://www.amazon.com/.*amazon.com.*?\/([A-Z0-9]{10})\/.*/i
//var links = document.getElementsByTagName("a"); //array

// TODO: Load images from side: http://stackoverflow.com/a/20711569/277601

http://stackoverflow.com/a/5947280/277601
(function(amznhc, $, undefined) {

	// http://stackoverflow.com/a/24649134/277601
	// Avoid recursive frame insertion...
	var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
	if (!location.ancestorOrigins.contains(extensionOrigin)) {
		pingForFakespotData();
	}

	// Get latest details from Fakespot
	//   Status will be:
	//     NONE - Ping again in 3 seconds
	//     BAD - Do not continue
	//     WAITING_FOR_PAGE_GENERATION - Ping again in 3 seconds
	//     ANALYZING - Ping again in 3 seconds
	//     NOT_ENOUGH_REVIEWS - Do not continue
	//     DONE - Do not continue, should have product and company grade
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

	function UpdateFakespotDetails(result){
		// TODO:
		// Create element if it doesn't exist, below the graph
		// 
		switch(result.status){
			case amazonfs.StatusEnum.WAITING_FOR_PAGE_GENERATION:
				break;
			case amazonfs.StatusEnum.ANALYZING:
				break;
			case amazonfs.StatusEnum.NOT_ENOUGH_REVIEWS:
				break;
			case amazonfs.StatusEnum.DONE:
				break;
			default:
				// Do nothing
				break;
		}
		// iframe of frame.html
		// var iframe = document.createElement('iframe');
		// // Must be declared at web_accessible_resources in manifest.json
		// iframe.src = chrome.runtime.getURL('frame.html');
		// 
		// // Some styles for a fancy sidebar
		// iframe.style.cssText = 'position:fixed;top:0;left:0;display:block;' +
		//                        'width:300px;height:100%;z-index:1000;';
		// // document.body.appendChild(iframe);
	
		// iframe of responseText
		// var iframe = document.createElement('iframe');
		// iframe.srcdoc = this.responseText;
		// iframe.src = "data:text/html;charset=utf-8," + escape(this.responseText);
		// // iframe.style.cssText = 'position:fixed;top:0;left:0;display:block;' +
		// //                        'width:300px;height:100%;z-index:1000;';
		// document.body.appendChild(iframe);
		// alert(responseText);
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

	function countDocAdditions(){
		nwtcr_domAdditionsCount += 1;
	};

	function onCamelRemove(){ 
		var element = document.getElementById('MyMiniCamelChart');
		if (element != null) {
			element.id = 'MyMiniCamelChartRemoved';
		}
		removeElement('MyCamelChart');
		removeElement('MyCamelSalesRankChart');
		nwtcr_domAdditionsCount = 0;
		
		document.documentElement.addEventListener('DOMNodeInsertedIntoDocument', countDocAdditions, false);
		setTimeout(function(){onDomChange2();}, 500);	
	};

	function addLink(url, text, parentID, getBy) {
	  var element;
	  if (getBy == "id") {
		element = document.getElementById(parentID);
	  } else if (getBy == "class") {
		var elements = document.getElementsByClassName(parentID);
		if (elements.length == 0) return false;
		element = elements[0];
	  } else if (getBy == "tag") {
		var elements = document.getElementsByTagName(parentID);
		if (elements.length == 0) return false;
		element = elements[0];
	  }
	  if (element == null) return false;

	  var span = document.createElement('span');
	  span.setAttribute('style', 'font-size : x-small');
	  span.innerHTML = text;

	  var label = document.createElement('a');
	  label.setAttribute('class', 'nav_a');
	  label.setAttribute('href', url);
	  label.setAttribute('rel', 'noreferrer');
	  label.appendChild(span);
	  //console.log("found " + parentID);
	  element.insertBefore(label, element.firstChild);
	  //element.insertBefore(document.createElement('br'), element.firstChild);
	  return true;
	}

	function addLinkImg(url, imgUrl, imgTitle, divName, addListener, addTitle, afterSiblingNotAsChild, parentID, getBy, width, height) {
	  var element;
	  var siblingToPlaceBefore;
	  if (getBy == "id") {
		element = document.getElementById(parentID);
	  } else if (getBy == "class") {
		var elements = document.getElementsByClassName(parentID);
		if (elements.length == 0) return false;
		element = elements[0];
	  } else if (getBy == "tag") {
		var elements = document.getElementsByTagName(parentID);
		if (elements.length == 0) return false;
		element = elements[0];
	  }
	  if (element == null) return false;
	  if (afterSiblingNotAsChild) {
		  siblingToPlaceBefore = element.nextSibling;
		  if (element != null) 
			  element = element.parentNode;
		  if (element == null) return false;
	  } else {
		  siblingToPlaceBefore = element.firstChild;
	  }

	  var div = document.createElement('div');
	  div.setAttribute('id', divName);
	  
	  var label = document.createElement('a');
	  label.setAttribute('class', 'nav_a');
	  label.setAttribute('href', url);
	  label.setAttribute('rel', 'noreferrer');
	  
	  var img = document.createElement('img');
	  img.setAttribute('src', imgUrl);
	  img.setAttribute('alt', imgTitle); // Alt if image does not exist
	  img.setAttribute('title', imgTitle); // Title should make hover text
	  img.setAttribute('width', width);
	  img.setAttribute('height', height);

	  if (addTitle) {
		  var span = document.createElement('span');
		  span.setAttribute('style', 'font-size : large; color : #9933ff;');
		  span.innerHTML = imgTitle;

		  div.appendChild(span);
		  div.appendChild(document.createElement('br'));
	  }
	  div.appendChild(label);
	  div.appendChild(document.createElement('br'));
	  div.appendChild(document.createElement('br'));
	  label.appendChild(img);
	  //console.log("found " + parentID);
	  if (afterSiblingNotAsChild)
		  element.insertBefore(div, siblingToPlaceBefore);
	  else
		  element.insertBefore(div, siblingToPlaceBefore);
	  
	  if (addListener) div.addEventListener('DOMNodeRemovedFromDocument', onCamelRemove, false);

	  return true;
	}

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

			// Decide which link to add:
			var finished = false; // There are multiple tags to try for different pages on Amazon
			if ((m = window.location.href.match(new RegExp("\\&showcamellargegraph=1\\b"))) != null) {
				// Different sections of Amazon have different html, and so I need to
				// try to add the Historical Data to multiple locations (once one works, quit)
				
				
				// Wait for settings page before adding sales rank
				//if (!finished) finished = addLinkImg(strCamelSalesRankLink, imgLargeSalesRankLoc, "Historical Sales Rank", 'MyCamelSalesRankChart', false, true, false, 'title_feature_div', "id", 500, 250);
				//if (!finished) finished = addLinkImg(strCamelSalesRankLink, imgLargeSalesRankLoc, "Historical Sales Rank", 'MyCamelSalesRankChart', false, true, false, 'product-title_feature_div', "id", 500, 250);
				//if (!finished) finished = addLinkImg(strCamelSalesRankLink, imgLargeSalesRankLoc, "Historical Sales Rank", 'MyCamelSalesRankChart', false, true, false, 'title_row', "id", 500, 250);
				//if (!finished) finished = addLinkImg(strCamelSalesRankLink, imgLargeSalesRankLoc, "Historical Sales Rank", 'MyCamelSalesRankChart', false, true, false, 'title', "id", 500, 250);
				//if (!finished) finished = addLinkImg(strCamelSalesRankLink, imgLargeSalesRankLoc, "Historical Sales Rank", 'MyCamelSalesRankChart', false, true, false, 'parseasinTitle', "class", 500, 250);
				finished = false;
				// Page example: Electric shavers (which was once http://www.amazon.com/gp/product/B003YJAZZ4 )
				//   This should NOT use title_feature_div, since it has a css max-height:55px. Instead, put it at the same level but just AFTER
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, true,  'title_feature_div', "id",    500, 400);
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, false, 'title_feature_div', "id",    500, 400);
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, false, 'product-title_feature_div', "id", 500, 400);
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, false, 'title_row',         "id",    500, 400);
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, false, 'title',             "id",    500, 400);
				if (!finished) finished = addLinkImg(strCamelLink, imgLargeLoc, "HistoricPriceShopper - Click to go to CamelCamelCamel", 'MyCamelChart', false, false, false, 'parseasinTitle',    "class", 500, 400);
			}
			finished = false;
			// Different sections of Amazon have different html, and so I need to
			// try to add the Historical Data to multiple locations (once one works, quit)
			if (!finished) finished = addLink(strCamelLink, "Track at CamelCamelCamel", 'buybox', "id");
			if (!finished) finished = addLink(strCamelLink, "Track at CamelCamelCamel", 'buy-box_feature_div', "id");
			if (!finished) finished = addLink(strCamelLink, "Track at CamelCamelCamel", 'dmusic_buy_box', "id");
			if (!finished) finished = addLink(strCamelLink, "Track at CamelCamelCamel", 'buy', "class");
			if (!finished) finished = addLink(strCamelLink, "Track at CamelCamelCamel", 'buying', "class");
			finished = false;
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buybox',              "id",    175, 100);
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buy-box_feature_div', "id",    175, 100);
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'dmusic_buy_box',      "id",    175, 100);
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buy',                 "class", 175, 100);
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buying',              "class", 175, 100);
			// Page example: Electric shavers (or deal of the day) (which was once http://www.amazon.com/gp/product/B003YJAZZ4 )
			//   This should NOT use buy-box_feature_div, since it doesn't seem to be created at the time the DOM is built :-/
			//   This should be a last-check since it puts it in wrong spot for other pages like http://www.amazon.com/gp/product/B00U3FPN4U
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'price_feature_div',   "id",    175, 100);
			// Page example: Baby K'tan Original Baby Carrier amazon.com/dp/B00FSKX266
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buybox_feature_div',   "id",    175, 100);
			if (!finished) finished = addLinkImg(strNewALink, imgSmallLoc, "Click to see larger image - HistoricPriceShopper", 'MyMiniCamelChart', true, false, false, 'buybox',   "data-feature-name",    175, 100);
		} else {
			//console.log("Didn't find Amazon stuff");
		}
		
	}
	// Close namespace amznhc (http://stackoverflow.com/a/5947280/277601)
} ( window.amznhc = window.amznhc || {}, jQuery ));

amznhc.addAmazonPriceGraph();
