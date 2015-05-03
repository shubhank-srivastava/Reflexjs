var _ = require('lodash');
var request = require('request');
var async = require('async');

/**
  * Instantiates a new dataset.
  * Parameters:
  * options - optional parameters.
  *   data : "Object - an actual javascript object that already contains the data",
  *   url : "String - url to fetch data from",
  *   delimiter : "String - a delimiter string that is used in a tabular datafile",
  *   importer : The classname of any importer (passes through auto detection based on parameters.
  *              For example: <code>Dataclot.Importers.Polling</code>.
  *   parser   : The classname of any parser (passes through auto detection based on parameters.
  *              For example: <code>DataDataclot.Parsers.Delimited</code>.
  */

var Reflex = function(options){
	this.initialize(options||{});
};

var Dataset = function(){

	this.initialize = function(options){
      // initialize importer from options or just create a blank
	     // one for now, we'll detect it later.
	    this.importer = options.importer || null;
	     //if importer is null then data must be defined
	    if(this.importer===null){
        this.data = options.data || null;
	    	if(this.data===null)
	    		throw new Error('Data for dataset is not defined.');
	    }else{
	    //if importer is defined then url must be defined	
	    	this.url = options.url || null;
	    	if(this.url===null)
	    		throw new Error('Url for importing data is not defined.');
	    }

      // default parser is object parser, unless otherwise specified.
	    this.parser  = options.parser || ObjParser;
	    if(options.delimiter)
	    	this.parser = CSVParser;
	    //return this.parser(options);
	};

  this.fetch = function(){
      if(this.importer!=null){
        var data;
        
        return data;
      }
      else
        return this.parser(this);//parse local data
  }

	return this;

}

var Importers = (function(){

  this.Remote = function(options,callback){
        request(options.url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              options.data = body;
              callback(null,options);
            }else
              throw new Error('Cannot get data from the url.');
        });
  };

  return function(){
    this.Remote = Remote;
    return this;
  };

})();

var Parsers = (function(){

	this.ObjParser = function(options){
	    var data = options.data;	
      var columns = _.keys(data[0]),
          columnData = {};

      //create the empty arrays
      _.each(columns, function( key ) {
        columnData[ key ] = [];
      });

      // iterate over properties in each row and add them
      // to the appropriate column data.
      _.each(columns, function( col ) {
        _.times(data.length, function( i ) {
          columnData[ col ].push( data[i][col] );
        });
      });
     
      return {
        columns : columns,
        data : columnData 
      };
	};

	this.CSVParser = function(options){
 		options = options || {};

	    this.delimiter = options.delimiter || ",";

	    this.skipRows = options.skipRows || 0;

	    this.emptyValue = options.emptyValue || null;

	    this.__delimiterPatterns = new RegExp(
	      (
	        // Delimiters.
	        "(\\" + this.delimiter + "|\\r?\\n|\\r|^)" +

	        // Quoted fields.
	        "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

	        // Standard fields.
	        "([^\"\\" + this.delimiter + "\\r\\n]*))"
	      ),
	      "gi"
	    );

      var columns = [],
          columnData = {},
          uniqueSequence = {};
      
      var uniqueId = function(str) {
        if ( !uniqueSequence[str] ) {
          uniqueSequence[str] = 0;
        }
        var id = str + uniqueSequence[str];
        uniqueSequence[str] += 1;
        return id;
      };


      var parseCSV = function(delimiterPattern, strData, strDelimiter, skipRows, emptyValue) {

        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ",");

        // Create an array to hold our individual pattern
        // matching groups.
        var arrMatches = null;

        // track how many columns we have. Once we reach a new line
        // mark a flag that we're done calculating that.
        var columnCount = 0;
        var columnCountComputed = false;

        // track which column we're on. Start with -1 because we increment it before
        // we actually save the value.
        var columnIndex = -1;

        // track which row we're on
        var rowIndex = 0;

        try {

          // trim any empty lines at the end
          strData = strData//.trim();
            .replace(/\s+$/,"")
            .replace(/^[\r|\n|\s]+[\r|\n]/,"\n");

          // do we have any rows to skip? if so, remove them from the string
          if (skipRows > 0) {
            var rowsSeen = 0,
                charIndex = 0,
                strLen = strData.length;

            while (rowsSeen < skipRows && charIndex < strLen) {
              if (/\n|\r|\r\n/.test(strData.charAt(charIndex))) {
                rowsSeen++;
              } 
              charIndex++;
            }

            strData = strData.slice(charIndex, strLen);
          }

          // Keep looping over the regular expression matches
          // until we can no longer find a match.
          function matchHandler(arrMatches) {
            // Get the delimiter that was found.
            var strMatchedDelimiter = arrMatches[ 1 ];

            // Check to see if the given delimiter has a length
            // (is not the start of string) and if it matches
            // field delimiter. If id does not, then we know
            // that this delimiter is a row delimiter.
            if ( strMatchedDelimiter.length &&
              ( strMatchedDelimiter !== strDelimiter )){

            // we have reached a new row.
            rowIndex++;

            // if we caught less items than we expected, throw an error
            if (columnIndex < columnCount-1) {
              rowIndex--;
              throw new Error("Not enough items in row");
            }

            // We are clearly done computing columns.
            columnCountComputed = true;

            // when we're done with a row, reset the row index to 0
            columnIndex = 0;

          } else {

            // Find the number of columns we're fetching and
            // create placeholders for them.
            if (!columnCountComputed) {
              columnCount++;
            }

            columnIndex++;
          }


          // Now that we have our delimiter out of the way,
          // let's check to see which kind of value we
          // captured (quoted or unquoted).
          var strMatchedValue = null;
          if (arrMatches[ 2 ]){

            // We found a quoted value. When we capture
            // this value, unescape any double quotes.
            strMatchedValue = arrMatches[ 2 ].replace(
              new RegExp( "\"\"", "g" ),
              "\""
            );

          } else {

            // We found a non-quoted value.
            strMatchedValue = arrMatches[ 3 ];
          }


          // Now that we have our value string, let's add
          // it to the data array.

          if (columnCountComputed) {

            if (strMatchedValue === '') {
              strMatchedValue = emptyValue;
            }

            if (typeof columnData[columns[columnIndex]] === "undefined") {
              throw new Error("Too many items in row"); 
            }

            columnData[columns[columnIndex]].push(strMatchedValue);  

          } else {

            var createColumnName = function(start) {
              var newName = uniqueId(start);
              while ( columns.indexOf(newName) !== -1 ) {
                newName = uniqueId(start);
              }
              return newName;
            };

            //No column name? Create one starting with X
            if ( _.isUndefined(strMatchedValue) || strMatchedValue === '' ) {
              strMatchedValue = 'X';
            }

            //Duplicate column name? Create a new one starting with the name
            if (columns.indexOf(strMatchedValue) !== -1) {
              strMatchedValue = createColumnName(strMatchedValue);
            }

            // we are building the column names here
            columns.push(strMatchedValue);
            columnData[strMatchedValue] = [];
          }
          }        

        //missing column header at start
        if ( new RegExp('^' + strDelimiter).test(strData) ) {
          matchHandler(['','',undefined,'']);
        }
        while (arrMatches = delimiterPattern.exec(strData)) {
          matchHandler(arrMatches);
        } // end while
        } catch (e) {
          throw new Error("Error while parsing delimited data on row " + rowIndex + ". Message: " + e.message);
        }

        // Return the parsed data.
        return {
          columns : columns,
          data : columnData
        };
       
      };

      return parseCSV(this.__delimiterPatterns,options.data,this.delimiter,this.skipRows,this.emptyValue);
	};

	return function() {
	    this.ObjParser = ObjParser;
	    this.CSVParser = CSVParser;
	    return this;
	};

})();

Importers.call(Dataset.prototype);
Parsers.call(Dataset.prototype);
Dataset.call(Reflex.prototype);

module.exports = Reflex;

