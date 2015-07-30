var Redis = require('redis');

function redisClient(conn) {
    this._client = Redis.createClient(conn.port || 6379, conn.hostname);
}

redisClient.prototype.get = function(key, next) {
    this._client.multi()
        .get(key + ".meta")
        .get(key)
        .exec(function(err, replies) {
            next(replies[0], replies[1]);
        });
};

redisClient.prototype.store = function(key, meta, body, seconds) {
    this._client.multi()
        .set(key + ".meta", meta)
        .set(key, body)
        .expire(key + ".meta", seconds || 60)
        .expire(key, seconds||60)
        .exec(function(err, resplies) {
        });
};

exports.client = redisClient;

