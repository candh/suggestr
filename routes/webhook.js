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
var senders = [];
var mongoose = require('mongoose');
var User = require('../models/User.model');
mongoose.set('debug', true);
var _ = require('underscore');
var genr = require('../tools/genre.js');
mongoose.connect(`mongodb://${DB_USER}:${DB_PASS}@ds149278.mlab.com:49278/messenger-bot`);

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
                    // if (event.message.quick_reply) {
                    //     payloadHandler(event);
                    // } else {
                    //     receivedMessage(event);
                    // }

                    receivedMessage(event);


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
    console.log('before if');
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
                typingOn(user_id);
                writeUserMovie(user_id, movie_id, function() {
                    generateMovie(user_id);
                });
                break;
            case "Another One":
                typingOn(user_id);
                generateMovie(user_id);
                break;
            case "I'll watch":
                resetGenre(user_id, function() {
                    typingOn(user_id);
                    writeUserMovie(user_id, movie_id, function() {
                        sendMessage(user_id, "Okay! That's great. Have a good one! I'll remember this!");
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
        console.log('\n\n\n messsage recieved \n\n\n', event.message);


        sendMessage(senderID, messageText);
        //
        // if (AI(messageText, 0, senderID) === undefined) {
        //     // then user asked for a movie
        //     typingOn(senderID);
        //     console.log(undefined);
        //
        //     // dev
        //     //sendGenericMessage(senderID);
        //     // sendMessage(senderID, "sorry we're working on the bot");
        // } else if (messageText.toLowerCase() == 'reset') {
        //     resetMovies(senderID);
        // } else if (AI(messageText, 1)) {
        //     // send a small text. Like just a chat!
        //     typingOn(senderID, function() {
        //         sendMessage(senderID, AI(messageText, 1));
        //     });
        //
        // } else {
        //     // we don't recognize what the user said
        //     sendError(senderID, 0);
        // }
        // process.stdout.write(JSON.stringify(message));
    }
}

// *************** AI
function AI(query, ctx, senderID) {
    // 0 - INTENT - Suggest a movie
    // 1 - INTENT - General
    query = query.toLowerCase();
    query = query.replace(/[^a-zA-Z]/g, "");
    if (ctx === 0) {
        if (query.match(/good/) || query.match(/suggest/) || query.match(/film/) || query.match(/movie/) || query.match(/tell/) || query.match(/watch/)) {
            // genre check
            genr(function(genres) {
                console.log(genres);
                new_genres = genres.filter(function(e, i) {
                    e = e.replace(/[^a-zA-Z]/g, "");
                    e = e.toLowerCase();
                    if (query.match(e)) {
                        return true;
                    }
                });
                saveToGenre(senderID, new_genres, function() {
                    generateMovie(senderID);
                })
            });


        } else {
            return false;
        }
    } else if (ctx == 1) {
        // okay so this is the general type of umm, conversation
        if (query.match(/hey/) || query.match(/hi/) || query.match(/hola/) || query.match(/bonjour/)) {
            return "Hello there human! I'm here to help you! You can ask me to suggest you movies!";
        } else if (query.match(/sup/) || query.match(/what's up/) || query.match(/whats up/)) {
            return "Nothing much. I'm good";
        } else if (query.match(/who made you/) || query.match(/creator/)) {
            return "I was made by my daddy. His twitter is @candhforlife";
        } else {
            return false;
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

function generateMovieSchema(recipientId, user) {
    var res = [];
    var flag = true;

    var suggested_total = user.suggested;
    var movies_total = user.movies;
    var genre_count = user.genre_count;
    getGenreForUser(recipientId, function(genre) {
        while (flag) {
            files = findByGenre(genre);
            file = files.generes;

            rand = getRandomInt(0, file.length - 1);
            name = file[rand]["Title"];
            poster = file[rand]["Poster"];
            country = file[rand]["Country"];
            lang = file[rand]["Language"];
            imdb_rating = file[rand]['imdbRating'];
            imdb_id = file[rand]['imdbID'];
            year = file[rand]['Year'];
            director = file[rand]['Director'];
            actors = file[rand]['Actors'];

            suggested = suggested_total.filter(function(e, i) {
                if (e == imdb_id) {
                    return e;
                }
            });
            movies = movies_total.filter(function(e, i) {
                if (e == imdb_id) {
                    return e;
                }
            });

            if (files.genre_flag == true) {
                totalMovies = files.generes.length;
                console.log('we here');
            }

            if (suggested.length == 0 && movies.length == 0) {
                flag = false;
                res[0] = {
                    poster: poster,
                    movie_id: file[rand]['imdbID']
                };
                res[1] = `${name} (${year})\nCountry: ${country},\nDirector: ${director},\nActors: ${actors}\nIMDB rating: ${imdb_rating}`;
                if (files.genre_flag) {
                    updateGenreCount(recipientId);
                }
                console.log(res);
                movieSchemaSend(res, recipientId);

            } else if (suggested.length > 0) {
                if (files.genre_flag) {
                    if (genre_count == file.length) {
                        console.log('here');
                        sendMessage(recipientId, "I already have suggested all the movies for this genre. Try another genre or no genre at all to see all the movies. If you wanna go over them again, reply with \"reset\"");
                        flag = false;
                    }

                } else if (iles.genre_flag == false) {
                    var tur = _.union(suggested_total, movies_total);
                    if (tur.length == totalMovies) {

                        console.log(recipientId, 'has run out of movies');
                        sendMessage(recipientId, "I have suggested you all the good movies I know.\
                                       I'm so sorry! You can hit the Internet for more but thats I'll have for you.\
                                       If you wanna go over the movies you skipped, reply with \"reset\"");

                        flag = false;
                    }
                }
            }
        }


    });

}

function findByGenre(new_generes) {

    var db = "./db/movies.json";
    var file = fs.readFileSync(db, 'utf8');
    if (file.length > 0) {
        file = JSON.parse(file);
        totalMovies = file.length;
    }
    if (new_generes.length == 0) {
        return {
            generes: file,
            genre_flag: false
        }
    }
    file = file.filter(function(e, i) {

        for (var i = 0; i < new_generes.length; i++) {
            if (e.Genre.includes(new_generes[i])) {
                return true;
            }
        }

    });
    return {
        genre_flag: true,
        generes: file
    };
}

function getGenreForUser(id, cb) {
    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            if (cb) {
                cb(user.genre)
            }
        }
    });
}

function generateMovie(recipientId, cb) {
    User.findById(recipientId, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user == null) {
            saveUserToDb(recipientId, function() {

                User.findById(recipientId, function(err, user) {
                    if (err) {
                        console.log(err);
                    }
                    if (user !== null) {
                        generateMovieSchema(recipientId, user)
                    }
                });
            });
        } else {
            generateMovieSchema(recipientId, user)
        }
    });

}

function movieSchemaSend(res, recipientId) {
    res.forEach(function(e, i) {
        var messageData;
        if (i === 0) {
            saveToSuggested(recipientId, e.movie_id, function(file) {
                console.log(file);
            });
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

function saveToGenre(user, genre, cb) {
    User.findById(user, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user != null) {
            user.genre = genre;
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err)
                }
                if (cb) {
                    cb();
                }
            })
        }
    });
}

function resetGenre(id, cb) {

    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            user.genre = [];
            user.genre_count = 0;
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err)
                }
                if (cb) {
                    cb();
                }
            })
        }
    });

}

function updateGenreCount(id, cb) {
    User.findById(id, function(err, user) {
        if (err) {
            console.log(err);
        } else if (user !== null) {
            if (user.genre_count == undefined) {
                user.genre_count = 0;
            }
            user.genre_count += 1;
            user.save(function(err, updatedUser) {
                if (err) {
                    console.log(err)
                }
                if (cb) {
                    cb();
                }
            })
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

function saveUserToDb(user, cb) {
    var NewUser = new User({
        _id: user,
        genre_count: 0
    });
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


            var suggested_total = user.suggested;
            var movies_total = user.movies;

            var cl = _.intersection(suggested_total, movies_total);
            var ai = _.difference(suggested_total, movies_total);


            if (ai.length === 0) {
                sendMessage(recipientId, "You've watched all the movies that I have in my database. Maybe it's time to go out!");

            } else {
                user.suggested = cl;
                user.save(function(err, updatedUser) {
                    if (err) {
                        console.log(err);
                    }
                    sendMessage(recipientId, "Ask me for movies so we can go over the movies that you skipped");
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

function sendMessage(recipientId, message) {
    typingOff(recipientId, function() {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: message
            }
        };
        callSendAPI(messageData);
    });
}

function callSendAPI(messageData) {
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

            console.log("Successfully sent message with id %s to recipient %s",
                messageId, recipientId);
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
            console.error(response);
            console.error(error);
        }
    });
}
// *********************


// exporting the router
module.exports = router;
