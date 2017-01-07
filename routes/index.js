var express = require('express');
var router = express.Router();

router.post('/', function(req, res) {
    res.send('working good');
});

// exporting the router
module.exports = router;
