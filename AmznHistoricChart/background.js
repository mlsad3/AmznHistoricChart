/**
 * Possible parameters for request:
 *  action: "xhttp" for a cross-origin HTTP request
 *  method: Default "GET"
 *  url   : required, but not validated
 *  data  : data to send in a POST request
 * From http://stackoverflow.com/a/7699773/277601
 * The callback function is called upon completion of the request
 * NOTE: If you want to have some back-and-forths between the content script and background page,
 *       use chrome.runtime.connect and chrome.runtime.onConnect instead of sendMessage/onMessage
 * */
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
	// console.log("Starting Step 0: " + request.action);
    if (request.action == "fakespot_xhttp") {
		amazonfs.triage(request.url, callback);
        return true; // prevents the callback from being called too early on return
    } else if (request.action == "fakespot_clearcache") {
		amazonfs.clearCache(request.url);
        return true; // prevents the callback from being called too early on return
    } else if (request.action == "amazonccc_xhttp") {
		amazonccc.triage(request.asin, callback);
        return true; // prevents the callback from being called too early on return
    } else if (request.action == "camelimage_xhttp") {
		console.log("Trying image");
		amazoncamel.loadImageData(request, callback);
		return true;
	} else {
		return false;
	}
});

(function(amazoncamel, $, undefined) {
	
	/**
	 * Get image data from non-secure website (http) and pass back
	 * http://stackoverflow.com/a/20285053/277601
	 * */
	amazoncamel.loadImageData = function(request, callback){
		var img = new Image();
		img.crossOrigin = 'Anonymous';
		img.onload = function() {
			var canvas = document.createElement('CANVAS');
			var ctx = canvas.getContext('2d');
			var dataURL;
			canvas.height = this.height;
			canvas.width = this.width;
			ctx.drawImage(this, 0, 0);
			dataURL = canvas.toDataURL("image/png");
			callback(dataURL);
		};
		img.src = request.url;
		if (img.complete || img.complete === undefined) {
			img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
			img.src = src;
		}
	}
	
} ( window.amazoncamel = window.amazoncamel || {}, jQuery ));
