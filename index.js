var Path   = require('path');
var URL    = require('url');
var Client = {
    redis: require('./client/redis').client,
};

var cacheStore;

exports.plugin = function(Proxy, Config) {
    if (!Config.cache || !Config.cache.store) {
        throw new Error("Please configure the cache");
    }
    if (!cacheStore) {
        var conn = URL.parse(Config.cache.store);
        var type = conn.protocol.substr(0, conn.protocol.length-1);
        if (!Client[type]) {
            throw new Error("Cannot find " + type + " driver");
        }

        cacheStore = new Client[type](conn);
        return;
    }

    var cache_id = Math.random();

    function isCacheable(conn) {
        if (conn.method != "GET") return 0;
        if (conn.headers.expires) {
            var tts = parseInt((new Date(conn.res.expires) - new Date) / 1000);
            if (tts > 0) return tts;
        }
        return conn.pathname.match(/\.(jpe?g|html|png|css|bmp|gif|woff)/i) ? 60 : 0;
    }

    Proxy.on('response', function(conn, res) {
        var ttl = isCacheable(conn);
        if (conn.is_cached == cache_id || !ttl) return;
        conn.headers.expires = new Date(new Date().getTime() + ttl * 1000).toString();
        conn.headers['X-Cache'] = 'MISS';
        var meta = JSON.stringify(conn.headers);

        conn.headers['X-Cache'] = 'HIT';
        var body = "";
        conn.res.on('data', function(bytes) {
            body += bytes;
        });
        conn.res.on('end', function() {
            cacheStore.store(conn.URL, meta, body, 60);
        });
    });

    Proxy.on('preforward', function(conn, next) {
        var cache = isCacheable(conn);
        cacheStore.get(conn.URL, function(meta, bytes) {
            if (meta) {
                conn.is_cached = cache_id;
                var resp = conn.response(200, JSON.parse(meta))
                resp.end(bytes);
            }
            next();
        });
    });
};
