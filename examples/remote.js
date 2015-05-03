var Reflex = require('../src/importer');

var urls = [
	'http://data.gov.in/node/165646/datastore/export/json',  
	'http://data.gov.in/node/165646/datastore/export/xml',	 
	'http://data.gov.in/resources/net-domestic-product-rural-and-urban-areas-madhya-pradesh-base-year-2004-05/download',
	'http://spreadsheets.google.com/feeds/cells/1lkGFWGxwG-i_Wuc6jtmKWx7DYmgGtTXAmY52pg7d_j8/od6/public/basic?alt=json'
	];

Reflex(urls,function(response){
	console.log(response);
	console.log(Reflex);
});

