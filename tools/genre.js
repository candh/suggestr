// this file generates all the genres that are in the movie list


module.exports = function(callback) {
    var fs = require('fs');
    var async = require('async');
    var movie_list = require('./movie-list.js');
    genres = [];
    var file = "./db/movies.json";
    fs.readFile(file, 'utf8', function(err, file) {
        if (err) {
            console.log(err);
        }
        file = JSON.parse(file);

        file.forEach(function(e, i) {
            var genre = e.Genre.split(', ');
            if (genre) {
                genre.forEach(function(e, i) {
                    genres.push(e);
                });
            } else {
                genres.push(cl);
            }
        });
        genres = genres.filter(function(e, i, arr) {
            if (arr.indexOf(e) == i) {
                return true;
            }
        });
        callback(genres);
    });
};
