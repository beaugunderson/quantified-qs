#!/usr/bin/env python2.7

import json

from datetime import datetime
from itertools import groupby
from os import getenv

from flask import Flask
from flask.ext.cache import Cache

from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.sqlalchemy import orm

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = getenv('MYSQL_URI')

app.debug = True

cache = Cache(app, config={ 'CACHE_TYPE': 'simple' })

db = SQLAlchemy(app)

def to_dict(self):
    for col in orm.class_mapper(self.__class__).mapped_table.c:
        yield (col.name, getattr(self, col.name))

db.Model.to_dict = to_dict
db.Model.__iter__ = lambda self: self.to_dict()

class ModelEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat()

        if hasattr(o, '__json__'):
            return o.__json__()

        return super(ModelEncoder, self).default(o)

class Url(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    tweet_id = db.Column(db.String(64))
    url = db.Column(db.String(128))
    title = db.Column(db.String(128))
    status_code = db.Column(db.Integer())
    user_id = db.Column(db.String(64))
    user_name = db.Column(db.String(64))
    created_at = db.Column(db.String(64))
    created_at_datetime = db.Column(db.DateTime())

    __tablename__ = "urls"
    __table_args__ = (db.UniqueConstraint('tweet_id', 'url',
        name='tweet_url_ix'),)

    def __init__(self, tweet_id, url, title, user_id, user_name,
            created_at_datetime):
        self.tweet_id = tweet_id
        self.url = url
        self.title = title
        self.user_id = user_name
        self.created_at_datetime = created_at_datetime

    def __json__(self):
        return {
            'id': self.id,
            'url': self.url,
            'title': self.title,
            'status': self.status_code,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'created_at': self.created_at_datetime,
        }

    def __repr__(self):
        return '<Url %r>' % self.url

@app.route("/urls")
@cache.cached(timeout=60)
def index():
    urls = Url.query.filter_by(status_code=200).all()

    return json.dumps(urls, cls=ModelEncoder)

def format_urls(urls):
    for url in urls:
        yield {
            'url': url.url,
            'title': url.title,
            'count': url.url_count
        }

@app.route("/urls/latest")
@cache.cached(timeout=60)
def urls_latest():
    urls = Url.query.filter_by(status_code=200) \
        .order_by('created_at_datetime DESC') \
        .limit(100).all()

    return json.dumps(urls, cls=ModelEncoder)

@app.route("/urls/by-count")
@cache.cached(timeout=60)
def urls_by_count():
    urls = db.session.query(Url.url, Url.title,
            db.func.count(Url.url).label('url_count')) \
        .filter_by(status_code=200) \
        .group_by(Url.url) \
        .order_by('url_count DESC') \
        .limit(100).all()

    return json.dumps(list(format_urls(urls)))

@app.route("/urls/by-week")
@cache.cached(timeout=60)
def urls_by_week():
    urls = db.session.query(Url.url, Url.title,
            db.func.count(Url.url).label('url_count'),
            db.func.week(Url.created_at_datetime).label('url_week')) \
        .filter_by(status_code=200) \
        .group_by('url_week', Url.url) \
        .order_by('url_week DESC', 'url_count DESC')

    def get_week(url):
        return url.url_week

    def format_weeks(urls):
        for week, week_urls in groupby(list(urls), get_week):
            yield {
                'week': week,
                'urls': list(format_urls(week_urls))
            }

    return json.dumps(list(format_weeks(urls)))

def format_users(users):
    for user in users:
        yield {
            'name': user.user_name,
            'count': user.user_count
        }

@app.route("/users/by-week")
@cache.cached(timeout=60)
def users_by_week():
    users = db.session.query(Url.user_name,
            db.func.count(Url.user_name).label('user_count'),
            db.func.week(Url.created_at_datetime).label('user_week')) \
        .group_by('user_week', Url.user_name) \
        .order_by('user_week DESC', 'user_count DESC')

    def get_week(user):
        return user.user_week

    def format_weeks(users):
        for week, week_users in groupby(list(users), get_week):
            yield {
                'week': week,
                'users': list(format_users(week_users))
            }

    return json.dumps(list(format_weeks(users)))

if __name__ == "__main__":
    app.run()
