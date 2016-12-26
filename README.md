# AmznHistoricChart

Adds a graph of the price history above the "Add to Cart" button in Amazon.

 - Clicking the minipic will load a larger chart on the screen.
 - Clicking the larger chart will take you to camelcamelcamel.com where you can setup email or twitter alerts to monitor when the product reaches trigger prices that you specify.


Also integrates Fakespot results into Amazon page
 - Product & Company grades (A, B, C, D, F)
 - Trustwerty Rating (fixed stars)
 - Clicking on the product/company grades or Trustwerty rating will take you to Fakespot.com to review the results
 - The Product/Company grades will go between CamelCamelCamel chart and the AddToCart button. The Trustwerty Rating stars will go to the right of the original Amazon rating stars

Right now the organization is ugly.
 - amazon.user.js - The main javascript file which adds our modifications to the page
 - background.js - Fakespot.com uses http, so we cannot directly add an iFrame to Fakespot in Amazon's https site. This does any querying in the background, and passes the results via messages back to the user page
 - amazonfs.js - The heavy-lifting for Fakespot communication (used by background.js)
 - lru.js - https://github.com/rsms/js-lru, Least Recently Used cache for Fakespot caching
 - jquery - not being used currently
 - frame.html - I originally thought I would be adding this as an iframe to amazon page. Probably not anymore.
 - *.png - The images used when adding to the Chrome Extension store