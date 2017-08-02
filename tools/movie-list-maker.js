var request = require('request');
var colors = require('colors');
var fs = require('fs');

var movie_list = require('./movie-list.js');

var file = "./db/movies.json";
var NEW_MOVIES = false;


var fullData = [];
var results = 0;
var parsedData = [];

var api_token = process.env.token;

movie_list.forEach(function(element, index) {
    request(`http://www.omdbapi.com/?t=${element}&y=&plot=short&r=json&apikey=${api_token}`, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            if (JSON.parse(body).Response == "False") {
                // so like the movie is not found. not cool
                console.log(`\n\n\nMovie not found : ${body} // ${element} \n\n\n`.red.underline.bold);
            } else {
                results++;
                fullData[index] = body;

                // means that we have retreived all the movies

                if (results == movie_list.length) {
                    for (var i = 0; i < fullData.length; i++) {

                        // inserting ids into the movie objects
                        var parsed = JSON.parse(fullData[i]);
                        parsed.id = i;

                        // making an array of all the movies
                        parsedData.push(parsed);

                        if (parsedData.length == fullData.length) {
                            console.log('movie list made');
                            fs.writeFile(file, JSON.stringify(parsedData), 'utf8', function(err) {
                                if (err) {
                                    console.log(err);
                                }

                            });
                        }

                    }
                }
            }
        } else {
            console.log(`\n\n\nERROR FROM THE SERVER : ${error} // ${index} \n\n\n`.red.underline.bold)
        }
    });
})
