#!/usr/bin/env node
"use strict";

var sqlite3 = require('sqlite3').verbose();
var util  = require('util');
var spawn = require('child_process').spawn;

var db = new sqlite3.Database('quora.sqlite3', createTables);

var TODO   = 1;
var SAVED  = 2;
var PARSED = 3;

var INSERT_IGNORE_SQL = 'INSERT OR IGNORE INTO QUESTIONS (url, status, title, body) VALUES (?, ?, ?, ?)';

function runMain() {
    // return;
    console.log("crawl.js::runMain");
    // Spawn a task that downloads links in the TODO state

    var download = spawn('./download.js');

    // console.log(download, download.pid);

    download.stdout.on('data', function(d) {
        console.log("download::", d.toString());
    });

    // 
    // Spawn a task that parses downloaded links in the SAVED state,
    // converts them to PARSED, enters fields in the DB and populates
    // the DB with more links in the TODO state.
    // 
    // If this task dies, we span one more to ensure that such a task
    // is always alive. This will happen because we will periodically
    // exit to work around the jsdom memory leak issue.
    // 

    var MIN_DELAY = 5 /* 5 second */;
    function spawnParser() {
        console.log("spawnParser() called");
        var parse = spawn('./parse.js');
        var started = new Date();

        parse.stdout.on('data', function(d) {
            console.log("parse::", d.toString());
        });

        parse.on('exit', function(code) {
            var diff = new Date() - started;
            if (diff > MIN_DELAY*1000) {
                console.log("restarting parser...");
                spawnParser();
            } else {
                setTimeout(spawnParser, (MIN_DELAY * 1000 - diff));
            }
        });
    }

    spawnParser();

}

var seedLinks = [
    '/What-do-you-hate-most-about-RabbitMQ', 
    '/What-are-the-best-JMS-queue-implementations', 
    '/Distributed-Caching/What-are-some-distributed-cache-systems', 
    '/How-do-SSD-drives-change-things-for-main-memory-databases', 
    '/Philanthropy-and-Charities/Should-I-donate-to-a-local-charity-focused-on-helping-local-women-and-girls-or-a-charity-focused-on-helping-women-and-girls-in-the-developing-world', 
    '/How-does-Gearman-compare-with-a-messaging-queue-system-like-Beanstalkd-RabbitMQ-and-Amazon-SQS', 
    '/Imagine-building-Quora-or-Facebook-today-using-Java-Spring-would-you-chose-ActiveMQ-ZeroMQ-RabbitMQ-or-a-XMPP-server', 
    '/Microsoft-History/Why-did-Steve-Ballmer-say-except-in-Nebraska-at-the-end-of-the-Windows-1-0-ad', 
    '/What-are-the-privacy-differences-between-ixquick-and-duckduckgo', 
    '/HBase/From-an-overall-cluster-throughput-point-of-view-why-would-replicating-asynchronously-run-faster-than-sync-replication', 
    'http://www.quora.com/Why-is-development-of-btrfs-taking-so-long'
];

function createTables() {
    db.serialize(function() {
        db.run("CREATE TABLE IF NOT EXISTS QUESTIONS (id INTEGER PRIMARY KEY AUTOINCREMENT, " + 
               "url VARCHAR(1024) UNIQUE, status INTEGER(1), title TEXT, body TEXT) ");

        db.run("CREATE INDEX IF NOT EXISTS status_index ON QUESTIONS (status)");

        // Insert Seed Links
        seedLinks.forEach(function(seedLink, i) {
            if (i == seedLinks.length - 1) {
                db.run(INSERT_IGNORE_SQL, seedLink, TODO, null, null, runMain);
            } else {
                db.run(INSERT_IGNORE_SQL, seedLink, TODO, null, null);
            }
        });
    });
}
