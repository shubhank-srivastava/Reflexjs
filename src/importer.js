var async = require('async');
var request = require('request');
var _ = require('lodash');

var Reflex = function (urls, callback) {
	var result = [];
	async.each(urls,function(url,cb){
		request(url, function (error, response, body) {
		  if (!error && response.statusCode == 200) {
        if(/spreadsheets/.test(url)){
          SHEETParser(JSON.parse(body),function(response){
            result.push(response);
            cb(null);
          });
        }
		    else if(/json/.test(url)){
				  JSONParser(JSON.parse(body),function(response){
				   	result.push(response);
				   	cb(null);
				  });
				}
				else if(/xml/.test(url)){
					XMLParser(body,function(response){
				   	result.push(response);
				   	cb(null);
				  });
				}
				else{
					CSVParser({data:body},function(response){
						result.push(response);
						cb(null);
					});
				}
			}
		});
	},function(err){
		callback(result);
	});	
};

module.exports = Reflex;

/********************************************PARSERS*************************************************/

var XMLParser = function(xml,convert_callback){
	var rows = xml.match(/<ROW[0-9]+>(.*?)<\/ROW[0-9]+>/g);
	async.waterfall([
		function(callback){
			var columns = [];
			var result = {};
			var row = rows[0];
			row = row.replace("<ROW1>",'');
			row = row.replace("</ROW1>",'');
			var keys = row.match(/<\/(.*?)>/g);
			for(var i=0;i<keys.length;i++){
					var col = keys[i].replace('</','').replace('>','');
					columns.push(col);
					result[col] = [];
				}
			callback(null,columns,result);
		},
		function(columns,result,callback){
			async.each(rows,function(row,cb){
				row = row.replace(/<ROW[0-9]+>/,'');
				row = row.replace(/<\/ROW[0-9]+>/,'');
				columns.forEach(function(key){
					var regex = new RegExp("<"+key+">(.*?)</"+key+">");
					result[key].push((row.match(regex))[1]);
				});
				cb(null);
			},function(err){
				callback(null,columns,result);
			});
		}],
		function(err,columns,result){
			if(err) throw new Error('Could not convert => '+xml);
			else
				convert_callback({columns:columns,data:result});
		});
};

var JSONParser = function(json,convert_callback){
	async.waterfall([
		function(callback){
			var columns = [];
			var result = {};
			for(var i=0;i<json.fields.length;i++){
				columns.push(json.fields[i].label);
				result[json.fields[i].label] = [];
			}
			callback(null,columns,result);

		},
		function(columns,result,callback){
			async.each(json.data, function(item,cb){
				columns.forEach(function(key){
					result[key].push(item[columns.indexOf(key)]);
				});
				cb(null);
			}, function(err){
				callback(null,columns,result);
			});

		}],function(err,columns,result){
			if(err) throw new Error('Could not convert => '+json);
			else
				convert_callback({columns:columns,data:result});
		});
};

var SHEETParser = function(sheet,convert_callback){
  var cells = sheet.feed.entry;
  columns = [];
  result = {};
  alphaColumns = {};
  async.waterfall([
    function(callback){
      async.each(cells,function(cell,cb){
          if(/^[A-Z]+1/.test(cell.title['$t'])){
            columns.push(cell.content['$t']);
            result[cell.content['$t']] = [];
            alphaColumns[cell.title['$t'].replace(/\d/,'')] = [];
            cb(null);
          }else{
            var col = cell.title['$t'].replace(/\d/,'');
            alphaColumns[col].push(cell.content['$t']);
            cb(null);
          }
      },function(err){
          callback(null,columns,result,alphaColumns);
      });
    },
    function(columns,result,alphaColumns,callback){
      var alphaKeys = Object.keys(alphaColumns);
      columns.forEach(function(key){
        result[key] = alphaColumns[alphaKeys[columns.indexOf(key)]];
      });
      callback(null,columns,result);
    }
  ],function(err,columns,result){
      if(err) throw new Error('Could not convert => '+cells);
        else
          convert_callback({columns:columns,data:result});
  });
};

var CSVParser = function(options,convert_callback){
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

      convert_callback(parseCSV(this.__delimiterPatterns,options.data,this.delimiter,this.skipRows,this.emptyValue));
	};
