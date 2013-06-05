var async = require('async');
var elongate = require('elongate');
var request = require('request');

var http = require('http');
var https = require('https');

http.globalAgent.maxSockets = 100;
https.globalAgent.maxSockets = 100;

var BASE_URL = 'http://search.twitter.com/search.json';

elongate = async.memoize(elongate);

var stats = {};

function getPage(qs) {
  console.log('# Fetching', (qs || 'first page'));

  request.get({
    url: BASE_URL + (qs ||
      '?include_entities=true&q=%40quantifiedself&count=50&result_type=recent&rpp=50'),
    json: true
  }, function (err, res, body) {
    // TODO: Not async anymore
    console.log('# Got', body.results.length, 'results');

    async.each(body.results, function (tweet, eachTweetCb) {
      if (tweet.entities && tweet.entities.urls) {
        // TODO: Use an async queue here instead
        async.each(tweet.entities.urls, function (url, eachUrlCb) {
          elongate(url.expanded_url, function (err, expandedUrl) {
            if (!stats[expandedUrl]) {
              stats[expandedUrl] = 0;
            }

            stats[expandedUrl]++;

            console.log(stats[expandedUrl], url.expanded_url, expandedUrl);

            eachUrlCb();
          });
        }, function () {
          eachTweetCb();
        });
      }
    }, function () {
      if (body.next_page) {
        getPage(body.next_page);
      } else {
        console.log('All done.');
        console.log(JSON.stringify(stats, null, 2));
      }
    });
  });
}

getPage();
