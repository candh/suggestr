// ******** requires and globals **********
var express = require('express');
var path = require("path");
var fs = require("fs");
var process = require('process');
var router = express.Router();
var colors = require('colors');
var request = require('request');
var access_token = process.env.access_token;
var PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
var DB_USER = process.env.user;
var DB_PASS = process.env.pass;
var API_AI = process.env.apiai;
var senders = [];
var mongoose = require('mongoose');
var User = require('../models/User.model');
var Dict = require('../models/Dictionary.model');
mongoose.set('debug', true);
var _ = require('underscore');
var genr = require('../tools/genre.js');
mongoose.connect(`mongodb://${DB_USER}:${DB_PASS}@ds149278.mlab.com:49278/messenger-bot`);
var apiai = require('apiai');
var api = apiai(API_AI);
var page_id = process.env.page_id;

// *********^
function typingOn(recipientId, cb) {
    var data = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_on"
    };
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: data

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;
            if (cb) {
                cb();
            }
        } else {
            console.error("Unable to send typing_on");
            // console.error(response);
            console.error(error);
        }
    });
}

function typingOff(recipientId, cb) {

    var data = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_off"
    };


    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: data

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;
            if (cb) {
                cb();
            }
        } else {
            console.error("Unable to send typing_on");
            // console.error(response);
            console.error(error);
        }
    });

}

// random integer generator for later use
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

// webhook challenege/
router.get('/', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === access_token) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

router.post('/', function(req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function(entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.message) {
                    if (event.message.quick_reply) {
                        payloadHandler(event);
                    } else {
                        receivedMessage(event);
                    }

                    //receivedMessage(event);


                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know
        // you've successfully received the callback. Otherwise, the request
        // will time out and we will keep trying to resend.
        res.sendStatus(200);
    }
});


function sendGreeting() {
    var data = {
        setting_type: "greeting",
        greeting: {
            text: "Hi {{user_first_name}}, I'm a movie suggesting bot! Type Hi to get started!"
        }
    };

    request({
        uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: data

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent greeting message to", recipientId);
        } else {
            console.error("Unable to send message.");
            // console.error(response);
            console.error(error);
        }
    });
}

sendGreeting();

function payloadHandler(event) {
    var payload = event.message.quick_reply.payload;
    var senderID = event.sender.id;
    var messageText = event.message.text;
    if (payload) {
        var properties = payload.split(', ');
        var obj = {};
        properties.forEach(function(property) {
            var tup = property.split(': ');
            obj[tup[0]] = tup[1];
        });

        var user_id = obj.user_id;
        var movie_id = obj.movie_id;
        console.log(user_id, movie_id);

        switch (messageText) {
            case "Seen it":
                typingOn(user_id, function() {
                    writeUserMovie(user_id, movie_id, function() {
                        generateMovie(user_id);
                    });
                });
                break;
            case "Another One":
                typingOn(user_id, function() {
                    generateMovie(user_id);
                });
                break;
            case "I'll watch":
                resetGenre(user_id, function() {
                    typingOn(user_id, function() {
                        writeUserMovie(user_id, movie_id, function() {
                            sendMessage(user_id, "Okay! That's great. Have a good one! I'll remember this!");
                        });
                    });
                });
                break;
        }
        return true;
    } else {
        return false;
    }
}

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;
    var messageId = message.mid;
    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {


        console.log(`\n\n\n\n\n\n ${messageText} , ${senderID} \n\n\n\n\n\n`);

        // okay so seems like the message we sent is also echoed back to the script.. with
        // the senderID of the page. why is that? I don't understand that.
        // So i'm just gonna ignore it because i'm having trouble understanding it.


        if (senderID !== page_id) {




            var ai = api.textRequest(messageText, {
                sessionId: 'suggestr'
            });

            ai.on('response', function(response) {

                var result = response.result;
                var parameters = result.parameters;
                var action = result.action;

                if (action == 'suggest.movie') {
                    // user asked for a movie

                    var genre = parameters.genre;
                    var type = parameters.type;


                    genr(function(genres) {
                        new_genres = genres.filter(function(e, i) {
                            e = e.replace(/[^a-zA-Z]/g, "");
                            e = e.toLowerCase();

                            for (var i = 0; i < genre.length; i++) {
                                if (genre[i].match(e)) {
                                    return true;
                                }
                            }
                        });

                        // if user specified no type, he ain't got no type
                        if (type.length == 0) {
                            type = null;
                        }

                        if (new_genres.length > 0) {
                            // then used did specified some genres
                            sendMessage(senderID, `You specified these genres: ${new_genres.join(', ')}. I'll get to it!`, function() {
                                saveToGenre(senderID, new_genres, function() {
                                    generateMovie(senderID, type);
                                });
                            });
                        } else {
                            sendMessage(senderID, `You specified no genre at all! It's okay, I'll tell you some good movies`, function() {
                                saveToGenre(senderID, new_genres, function() {
                                    generateMovie(senderID, type);
                                });
                            });
                        }
                    });
                    console.log(genre, type)
                } else if (action == 'actions') {
                    var actions = parameters.actions;

                    var already_seen = [
                        "Oh! I'll just suggest another one",
                        "Okay, that's cool. Another one coming right up!",
                        "Yeah of course, here's another good movie",
                        "Don't even worry about it! I got you covered",
                        "I'll remember that. Let's try another one",
                        "Hmm, lets try another",
                        "I think you'll like this one!",
                        "Maybe this, then?",
                        "Here's a good movie"
                    ];

                    var usr_watch = [
                        "Okay, have a good time!",
                        "Glad to be of your assitance, Enjoy your movie!",
                        "Oh, that's great... I can rest now. Just kidding, machines don't rest",
                        "hmu if you need another good movie!"
                    ]

                    var al = getRandomInt(0, already_seen.length - 1);
                    var si = getRandomInt(0, usr_watch.length - 1);

                    switch (actions) {
                        case 'watched':
                            console.log('ALREADY SEEN')
                            sendMessage(senderID, already_seen[al], function() {
                                typingOn(senderID, function() {
                                    retrieveLastMovie(senderID, function(mov) {
                                        writeUserMovie(senderID, mov, function() {
                                            generateMovie(senderID);
                                        });
                                    });
                                });
                            });
                            break;
                        case "i'll watch":
                            console.log('USER WILL WATCH');
                            sendMessage(senderID, usr_watch[si], function() {
                                resetGenre(senderID, function() {
                                    typingOn(senderID, function() {
                                        retrieveLastMovie(senderID, function(mov) {
                                            writeUserMovie(senderID, mov, function() {});
                                        });
                                    });
                                });
                            });
                            break;
                        case "another one":
                            console.log('ANOTHER ONE');
                            sendMessage(senderID, already_seen[al], function() {
                                typingOn(senderID, function() {
                                    generateMovie(senderID);
                                });
                            })
                            break;
                            // aint nobody got time fo default my ni... nevermind
                    }
                } else if (action == 'smalltalk.greetings') {
                    var msg = result.fulfillment.speech;
                    typingOn(senderID, function() {
                        sendMessage(senderID, msg);
                    });
                }

            });
            ai.on('error', function(error) {
                console.log(error);
            });

            ai.end();
        }

        // console.log('\n\n\n messsage recieved \n\n\n', event.message);
        //sendMessage(senderID, messageText);
        // if (AI(messageText, 0, senderID) === undefined) {
        //     // then user asked for a movie
        //     typingOn(senderID);
        //     // dev
        //     //sendGenericMessage(senderID);
        //     // sendMessage(senderID, "sorry we're working on the bot");
        // } else if (AI(messageText, 2)) {
        //     // user asked for another movie
        //     typingOn(senderID, function() {
        //         generateMovie(senderID);
        //     });
        // } else if (AI(messageText, 3)) {
        //     // that means that the user have already seen that movie that we just suggested
        //     typingOn(senderID, function() {
        //         retrieveLastMovie(senderID, function(mov) {
        //             writeUserMovie(senderID, mov, function() {
        //                 generateMovie(senderID);
        //             });
        //         });
        //     });

        // } else if (AI(messageText, 4)) {
        //     resetGenre(senderID, function() {
        //         typingOn(senderID, function() {
        //             retrieveLastMovie(senderID, function(mov) {
        //                 writeUserMovie(senderID, mov, function() {
        //                     sendMessage(senderID, "Okay! That's great. Have a good one! I'll remember this!");
        //                 });
        //             });
        //         });
        //     });
        // } else if (messageText.toLowerCase() == 'reset') {
        //     resetMovies(senderID);
        // } else if (AI(messageText, 1)) {
        //     // send a small text. Like just a chat!
        //     typingOn(senderID, function() {
        //         sendMessage(senderID, AI(messageText, 1));
        //     });

        // } else {
        //     // we don't recognize what the user said
        //     sendError(senderID, 0);
        // }
        process.stdout.write(JSON.stringify(message));
    }



}



function retrieveLastMovie(id, cb) {
    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            if (cb) {
                cb(user.suggested[user.suggested.length - 1]);
            }
        }
    });
}

// *************** AI
function AI(query, ctx, senderID) {
    // 0 - INTENT - Suggest a movie
    // 1 - INTENT - General
    query = query.toLowerCase();
    query = query.replace(/[^a-zA-Z]/g, "");
    if (ctx === 0) {
        if (query.includes("good") || query.includes("suggest") || query.includes("film") || query.includes("movie") || query.includes("tell") || query.includes("watch") || query.includes("somethingnew")) {
            // genre check
            genr(function(genres) {
                new_genres = genres.filter(function(e, i) {
                    e = e.replace(/[^a-zA-Z]/g, "");
                    e = e.toLowerCase();
                    if (query.match(e)) {
                        return true;
                    }
                });
                saveToGenre(senderID, new_genres, function() {
                    generateMovie(senderID);
                });
            });


        } else {
            return false;
        }
    } else if (ctx == 1) {
        // okay so this is the general type of umm, conversation
        if (query.includes("hey") || query.match("hi") || query.match("hola") || query.match("bonjour")) {
            return "Hello there human! I'm here to help you! You can ask me to suggest you movies! Beneath every movie i suggest, should be three buttons 😊 just press them for the best experience";
        } else if (query.includes("sup") || query.includes("whats up")) {
            return "Nothing much. I'm good";
        } else if (query.includes("who made you") || query.includes("creator")) {
            return "I was made by my daddy. His twitter is @candhforlife";
        } else {
            return false;
        }
    } else if (ctx == 2) {
        if (query.includes("another") || query.includes("again") || query.includes("better") || query.includes("else")) {
            return true;
        }
    } else if (ctx == 3) {
        if (query.includes("seen") || query.includes("watched")) {
            return true;
        }
    } else if (ctx == 4) {
        if (query.includes("great") || query.includes("illwatch")) {
            return true;
        }
    }
}

function sendError(recipientId, ctx) {
    // 0 - not recognized command - initial
    //
    if (ctx === 0) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: "I'm sorry. Try typing \"Suggest me some movies\" or \"What should I watch today?\""
            }
        };
        callSendAPI(messageData);
    }
}
// *********************

// **************************
// prepare movie for sending

function suggested_T(suggested_total) {
    suggested_total = suggested_total.filter(function(e, i) {
        if (e == imdb_id) {
            return e;
        }
    });
    return suggested_total;
}

function movies_T(movies_total) {
    movies_total = movies_total.filter(function(e, i) {
        if (e == imdb_id) {
            return e;
        }
    });
    return movies_total;
}

function cnt(file, suggested_total) {
    file = file.filter(function(e, i) {
        if (_.contains(suggested_total, e.imdbID)) {
            return true;
        }
    });
    return file;
}

function generateMovieSchema(recipientId, user) {
    var res = [];
    var flag = true;

    var suggested_total = user.suggested;
    var movies_total = user.movies;
    var genre_count = user.genre_count;
    getGenreForUser(recipientId, function(genre) {
        while (flag) {
            files = findByGenre(genre);
            file = files.genres;
            if (files.error) {
                sendMessage(recipientId, 'No movie with this genre found!');
                flag = false;
                break;
            }
            rand = getRandomInt(0, file.length - 1);
            name = file[rand].Title;
            poster = file[rand].Poster;
            country = file[rand].Country;
            lang = file[rand].Language;
            imdb_rating = file[rand].imdbRating;
            imdb_id = file[rand].imdbID;
            year = file[rand].Year;
            director = file[rand].Director;
            actors = file[rand].Actors;
            plot = file[rand].Plot;

            // no funcitons inside a loop - increasing perfomance!
            suggested = suggested_T(suggested_total);
            movies = movies_T(movies_total);

            if (files.genre_flag) {
                totalMovies = files.genres.length;
            }

            if (suggested.length === 0 && movies.length === 0) {
                flag = false;
                res[0] = {
                    poster: poster,
                    movie_id: file[rand].imdbID
                };
                res[1] = `🎬 ${name} (${year})\nCountry: ${country},\nDirector: ${director},\nActors: ${actors}\nIMDB rating: ${imdb_rating}`;
                movieSchemaSend(res, recipientId);

            } else if (suggested.length > 0) {
                if (files.genre_flag) {

                    var cl = cnt(file, suggested_total);

                    if (cl.length == file.length) {
                        sendMessage(recipientId, "I already have suggested all the movies for this genre. Try another genre or no genre at all to see all the movies. If you wanna go over them again, reply with \"reset\"");
                        flag = false;
                    }

                } else if (files.genre_flag === false) {
                    var tur = _.union(suggested_total, movies_total);
                    if (tur.length == totalMovies) {

                        console.log(recipientId, 'has run out of movies');
                        sendMessage(recipientId, "I have suggested you all the good movies I know. \
                                       I'm so sorry! You can hit the Internet for more but thats I'll have for you.\
                                       If you wanna go over the movies you skipped, reply with \"reset\"");

                        flag = false;
                    }
                }
            }
        }


    });

}

function findByGenre(new_genres) {

    var db = "./db/movies.json";
    var file = fs.readFileSync(db, 'utf8');
    if (file.length > 0) {
        file = JSON.parse(file);
        totalMovies = file.length;
    }
    if (new_genres.length === 0) {
        return {
            genres: file,
            genre_flag: false
        };
    }
    file = file.filter(function(e, i) {

        genre_orig = e.Genre.split(', ');
        var cl = _.intersection(genre_orig, new_genres);
        if (cl.length == new_genres.length) {
            return true;
        }
    });

    if (file.length > 0) {

        return {
            genre_flag: true,
            genres: file
        };

    } else {
        return {
            error: true
        };
    }
}

function getGenreForUser(id, cb) {
    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            if (cb) {
                cb(user.genre);
            }
        }
    });
}

function generateMovie(recipientId, cb) {
    User.findById(recipientId, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user === null) {
            saveUserToDb(recipientId, function() {

                User.findById(recipientId, function(err, user) {
                    if (err) {
                        console.log(err);
                    }
                    if (user !== null) {
                        generateMovieSchema(recipientId, user);
                    }
                });
            });
        } else {
            generateMovieSchema(recipientId, user);
        }
    });

}

function movieSchemaSend(res, recipientId) {
    res.forEach(function(e, i) {
        var messageData;
        if (i === 0) {
            saveToSuggested(recipientId, e.movie_id, function(file) {});
            messageData = {
                recipient: {
                    id: recipientId
                },
                message: {
                    "quick_replies": [{
                        "content_type": "text",
                        "title": "Seen it",
                        "payload": `user_id: ${recipientId}, movie_id: ${e.movie_id}`,
                    }, {
                        "content_type": "text",
                        "title": "I'll watch",
                        "payload": `user_id: ${recipientId}, movie_id: ${e.movie_id}`,
                    }, {
                        "content_type": "text",
                        "title": "Another One",
                        "payload": `user_id: ${recipientId}, movie_id: ${e.movie_id}`,
                    }],

                    "attachment": {
                        "type": "image",
                        "payload": {
                            "url": e.poster
                        }
                    }
                }
            };
            callSendAPI(messageData);
        } else if (i == 1) {
            messageData = {
                recipient: {
                    id: recipientId
                },
                message: {
                    text: e,
                }
            };
            callSendAPI(messageData);
        }
    });


}

function saveToGenre(id, genre, cb) {
    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            user.genre = [];
            user.genre = genre;
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err);
                }
                if (cb) {
                    cb();
                }
            });
        } else if (user === null) {
            saveUserToDb(id, genre, function() {

                if (cb) {
                    cb();
                }
            });

        }
    });
}

function resetGenre(id, cb) {

    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            user.genre = [];
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err);
                }
                if (cb) {
                    cb();
                }
            });
        }
    });

}

function saveToSuggested(user, movie, cb) {
    User.findById(user, function(err, user) {
        if (err) {
            console.log(err, 'User not found or whatever');
        }
        var cl = user.suggested;
        var ai = cl.filter(function(e, i) {
            if (e == movie) {
                return true;
            }
        });
        if (ai.length === 0) {
            user.suggested.push(movie);
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err);
                }
                if (cb) {
                    cb(user);
                }
            });
        }
    });
}

function saveUserToDb(user, genres, cb) {
    var NewUser = new User({
        _id: user
    });

    if (typeof genres == "object") {
        NewUser = new User({
            _id: user,
            genre: genres
        });
    }

    NewUser.save(function(err) {
        if (err) console.log((err));
        console.log('USER SAVED');
        if (cb) {
            cb();
        }
    });
}

function writeUserMovie(user_id, movie_id, cb) {
    User.findById(user_id, function(err, user) {
        if (err) {
            console.log(err);
            return;
        }
        var cl = user.movies;
        var ai = cl.filter(function(e, i) {
            if (e == movie_id) {
                return true;
            }
        });
        if (ai.length === 0) {
            user.movies.push(movie_id);
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err);
                }
                if (cb) {
                    cb();
                }
            });
        }
    });
}

function resetMovies(recipientId, cb) {

    User.findById(recipientId, function(err, user) {
        if (err) {
            console.log(err);
            return;
        } else if (user === null) {
            console.log('User Not found');
        } else {

            var genre_count = 0;
            var suggested_total = user.suggested;
            var movies_total = user.movies;

            var cl = _.intersection(suggested_total, movies_total);
            var ai = _.difference(suggested_total, movies_total);


            if (ai.length === 0) {
                sendMessage(recipientId, "No movies have been found that you've not watched.");
            } else {
                user.suggested = cl;
                user.save(function(err, updatedUser) {
                    if (err) {
                        console.log(err);
                    }
                    sendMessage(recipientId, "Ask me for movies again so we can go over the movies that you skipped");
                    if (cb) {
                        cb(user);
                    }
                });
            }

        }
    });
}
// *********************


// ******************** API functions

function sendMessage(recipientId, message, cb) {
    typingOff(recipientId, function() {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: message
            }
        };
        callSendAPI(messageData, cb);
    });
}

function callSendAPI(messageData, cb) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: messageData

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            //console.log("Successfully sent message with id %s to recipient %s",
            // messageId, recipientId);
            if (cb) {
                cb();
            }
            senders.push(recipientId);
            User.findById(recipientId, function(err, user) {
                if (err) {
                    console.log(err);
                } else if (user === null) {
                    saveUserToDb(recipientId);
                } else {
                    console.log('user already exists');
                }
            });
        } else {
            console.error("Unable to send message.");
            //console.error(response);
            console.error(error);
        }
    });
}
// *********************


// exporting the router
module.exports = router;
