#!/bin/bash

# Gets an application token from Twitter

CONSUMER_KEY=""
CONSUMER_SECRET=""

ENCODED_SECRET=$(printf "%s:%s" "$CONSUMER_KEY" "$CONSUMER_SECRET" | base64 -w 0)

http -v --form \
  POST https://api.twitter.com/oauth2/token \
  Content-Type:"application/x-www-form-urlencoded;charset=UTF-8" \
  Authorization:"Basic $ENCODED_SECRET" \
  grant_type="client_credentials"
