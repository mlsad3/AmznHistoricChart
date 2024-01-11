const amazonccc = (function () {
  var debug = false;
  // Keep info on the last 100 Amazon products
  var cccCache = new LRUMap(100);

  const StatusEnum = {
    NONE: 0,
    BAD: 1,
    DONE: 2,
  };
  /**
	 * Decide what stage to skip to, based on cached values
	 * */
  function triage(asin, callback) {
    if (asin == null || asin == "") {
      callback(ccc);
      return true;
    }
    if (debug) console.log("Starting Triage for " + asin);
    // alert("Ready?");
    var ccc = cccCache.get(asin);
    if (ccc == null) {
      ccc = {
        asin: asin,
        camelUrl: "https://camelcamelcamel.com/product/" + asin,
        productUrl: null,
        status: StatusEnum.NONE,
        graphAmazonURL: null,
        graph3PNewURL: null,
        graph3PUsedURL: null,
      };
      cccCache.set(asin, ccc);
    }
    switch (ccc.status) {
      case StatusEnum.DONE:
        callback(ccc);
        break;
      case StatusEnum.BAD:
        if (debug) console.log("Cached Status:BAD - Starting Over");
      case StatusEnum.NONE:
      default:
        getPageHome(ccc, callback);
        break;
    }
    return true;
  }
  /**
	 * Gets the redirect location for product
	 * */
  async function getPageHome(ccc, callback) {

    if (debug) console.log("Starting Step 1 for " + ccc.camelUrl);
    if (debug) console.log(ccc)

    let url = ccc.productUrl || ccc.camelUrl;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept:
            "*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
        },
      });

      if (!response.ok) {
        throw new Error("Request failed with status: " + response.status);
      }

      const text = await response.text();

      if (debug) console.log(response);
      if (debug) console.log("received text" + text);
      if (debug) console.log("Got status: " + response.status);
      if (debug) console.log("Navigated to " + url);

      // The page may be telling us we are getting redirected
      // Prevent a redirect loop by checking if we already have the location (ccc.productUrl)
      var myRe = /You are being.*camelcamelcamel.com(\/[^"]+)">redirected/i;
      var result = myRe.exec(text);
      if (ccc.productUrl == null && result != null && result.length > 1) {
        var productUrl = "https://camelcamelcamel.com" + result[1];
        ccc.productUrl = productUrl;
        if (debug) console.log("Found product URL as: " + ccc.productUrl);
        amazonccc.getPageHome(ccc, callback);
        return;
      }

      // value="amazon" id="price_type_0" checked="checked" disabled="disabled"
      myRe = /value="amazon"\s*id="price_type_(0|amazon)"[^>]*>/i;
      result = myRe.exec(text);
      if (result != null && result.length > 0) {
        var disabledRe = /disabled="disabled"/i;
        var isDisabledResult = disabledRe.exec(result[0]);
        if (isDisabledResult != null) {
          ccc.graphAmazonURL = null;
        } else {
          ccc.graphAmazonURL =
            "https://charts.camelcamelcamel.com/us/" +
            ccc.asin +
            "/amazon.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
        }
        if (debug)
          console.log("Found graphAmazonURL as: " + ccc.graphAmazonURL);
      } else {
        if (debug)
          console.error("Quitting3 amazonccc.getPageHome Didn't find amazon");
        ccc.graphAmazonURL = null;
      }

      // value="new" id="price_type_1" checked="checked" disabled="disabled"
      myRe = /value="new"\s*id="price_type_(1|new)"[^>]*>/i;
      result = myRe.exec(text);
      if (result != null && result.length > 0) {
        var disabledRe = /disabled="disabled"/i;
        var isDisabledResult = disabledRe.exec(result[0]);
        if (isDisabledResult != null) {
          ccc.graph3PNewURL = null;
        } else {
          ccc.graph3PNewURL =
            "https://charts.camelcamelcamel.com/us/" +
            ccc.asin +
            "/new.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
        }
        if (debug) console.log("Found graph3PNewURL as: " + ccc.graph3PNewURL);
      } else {
        if (debug)
          console.error("Quitting4 amazonccc.getPageHome Didn't find new");
        ccc.graph3PNewURL = null;
      }

      // value="used" id="price_type_2" checked="checked" disabled="disabled"
      myRe = /value="used"\s*id="price_type_(2|used)"[^>]*>/i;
      result = myRe.exec(text);
      if (result != null && result.length > 0) {
        var disabledRe = /disabled="disabled"/i;
        var isDisabledResult = disabledRe.exec(result[0]);
        if (isDisabledResult != null) {
          ccc.graph3PUsedURL = null;
        } else {
          ccc.graph3PUsedURL =
            "https://charts.camelcamelcamel.com/us/" +
            ccc.asin +
            "/used.png?force=1&zero=0&desired=false&legend=1&ilt=1&tp=all&fo=0&lang=en";
        }
        if (debug)
          console.log("Found graph3PUsedURL as: " + ccc.graph3PUsedURL);
      } else {
        if (debug)
          console.error("Quitting5 amazonccc.getPageHome Didn't find old");
        ccc.graph3PUsedURL = null;
      }
      ccc.graphSalesRankURL =
        "https://charts.camelcamelcamel.com/us/" +
        ccc.asin +
        "/sales-rank.png?force=1&zero=0&legend=1&ilt=1&tp=all&fo=0&lang=en";
      if (debug)
        console.log("Found graphSalesRankURL as: " + ccc.graphSalesRankURL);

      ccc.status = StatusEnum.DONE;
      callback(ccc);
    } catch (err) {
      console.error("Fetching Error:", err);
      ccc.status = StatusEnum.BAD;
      callback(ccc);
    }
  }

  return {
    StatusEnum,
    triage,
    getPageHome,
  };
})();