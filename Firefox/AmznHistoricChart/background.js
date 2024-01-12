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
chrome.runtime.onMessage.addListener(function (request, sender, callback) {
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
    amazoncamel.loadImageData(request, callback);
    return true;
  } else {
    return false;
  }
});

const amazoncamel = (() => {
  // Refactored loadImageData without DOM
  loadImageData = async (request, callback) => {
    try {
      const response = await fetch(request.url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const dataURL = reader.result;
        callback(dataURL);
      };
    } catch (err) {
      console.error("Error fetching image:", error);
      callback(
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
      );
      // Handle errors appropriately, e.g., call the callback with an error message
    }
  };
  return {
    loadImageData,
  };
})();