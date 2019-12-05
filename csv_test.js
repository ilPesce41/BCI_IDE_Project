var fs = require('fs');
const { parse } = require('json2csv');




var date = new Date();
var appendThis = [
    {
        'Time': date.getTime(),
        'Total': '2000',
        'Name': 'myName2'
    }
];

function appendCSV(data,filename){
    var newLine= "\r\n";
    var fields = ['Time','Total', 'Name'];
    var toCsv = {
        header: false
    };
    fs.stat(filename, function (err, stat) {
        if (err == null) {
            var csv = parse(data,toCsv) + newLine;
            fs.appendFile(filename, csv, function (err) {
                if (err) throw err;
            });
        }
        else {
            //write the headers and newline
            console.log('New file, just writing headers');
            fields= (fields + newLine);

            fs.writeFile('file.csv', fields, function (err) {
                if (err) throw err;
                console.log('file saved');
            });
        }
    });
}

var date_str =date.toDateString().split(" ").join("");
var time_str = date.toLocaleTimeString().split(" ").join("");
time_str = time_str.split(":").join("_");

console.log(date_str+"_"+time_str+".csv");
appendCSV({},"file.csv");