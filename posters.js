// run this file if you want all the posters
var fs = require('fs');
var request = require('request');
var movie_list = require('./tools/movie-list.js');
var file = "./db/movies.json";

file = fs.readFile(file, 'utf8', function(err, data) {
    if (err) {
        console.log(err);
    }

    data = JSON.parse(data);
    data.forEach(function(e, i) {
        download(e.Poster, `./posters/poster ${i}.png`, function() {});
    })

})

var download = function(uri, filename, callback) {
    request.head(uri, function(err, res, body) {
        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);

        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};
