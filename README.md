# Reflexjs
A CSV, JSON, XML and google spreadsheet importer and parser for open-data making it suitable for data manipulation and visualizations.

## Example
It is as simple as - 
```
var Reflex = require('../src/importer');
Reflex(my_url, function(response){
  /* The response is
    {
      columns: ['column1','column2',...],
      data: {
          column1: [.....],
          column2: [.....]
        }
    }
  */
});

```
Check out more [examples](https://github.com/shubhank-srivastava/Reflexjs/tree/master/examples)
