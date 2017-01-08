var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var DictSchema = new Schema({
    words : Array
})


module.exports = mongoose.model('Dict', DictSchema);
