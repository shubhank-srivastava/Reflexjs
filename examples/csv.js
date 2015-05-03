var Reflex = require('../src/reflex');

var ds = new Reflex({
	data: "S.No.,INDUSTRY OF ORIGIN (Rs. In Lakhs),Rural,Urban,Total,Rural   %,Urban %\n1,Agriculture (including animal husbandry),2394272,149295,2543567,94.13,5.87\n2,Forestry and Logging,293224,43805,337029,87,13",
	delimiter: ','
});

console.log(ds.fetch());
