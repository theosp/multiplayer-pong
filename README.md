# Multiplayer Pong

Use mobile phones as remote controllers for a Pong game. 

# Installation

From github:

    $ git clone .../multiplayer-pong.git
    $ cd multiplayer-pong
    $ git submodule init
    $ git submodule update
    $ npm install

# Usage

1. Edit config/config.json:

Set domain to your host domain or nat ip.

2. Run the server:

    $ sudo node server/server.js

3. On the browser go to:

    http://your-domain/

# Notes

Tested only on node v0.10.13
