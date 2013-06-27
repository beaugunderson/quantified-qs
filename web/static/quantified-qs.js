/*globals $:true, moment:true, URI:true, _:true*/

function formatUrl(url) {
  var uri = new URI(url);

  return uri.authority().replace(/^www\./, '') + uri.resource();
}

function formatUser(user) {
  return '<a href="https://twitter.com/' + user + '">' + user + '</a>';
}

$(function () {
  $.getJSON('/quantified-qs/api/urls/latest', function (urls) {
    _.first(urls, 5).forEach(function (url) {
      var time = moment.utc(url.created_at).local().fromNow();

      $('#latest').append('<li><a href="' + url.url + '">' + url.title +
        '</a> <span class="user">' + formatUser(url.user_name) + '</span> ' +
        '<abbr class="time" title="' + url.created_at + '">' + time +
        '</abbr></li>');
    });
  });

  $.getJSON('/quantified-qs/api/urls/by-week', function (weeks) {
    weeks.forEach(function (week) {
      $('<h2>Week ' + week.week + '</h2>').appendTo('#urls');
      $('<div id="week-' + week.week + '"><p><strong>Top URLs:</strong><div>')
        .appendTo('#urls');

      var $ul = $('<ul></ul>').appendTo('#week-' + week.week);

      _.first(week.urls, 10).forEach(function (urls) {
        var displayUrl = formatUrl(urls.url);
        var displayTitle = urls.title;

        $ul.append('<li><a href="' + urls.url + '">' +
          (displayTitle || displayUrl) + '</a> ' +
          '<strong>' + urls.count + ' tweets</strong>' +
          (displayTitle ? ('<br /><span class="url">' + displayUrl + '</span>') : '') +
        '</li>');
      });
    });

    $.getJSON('/quantified-qs/api/users/by-week', function (weeks) {
      weeks.forEach(function (week) {
        var $p = $('<p></p>').prependTo('#week-' + week.week);

        $p.html('<strong>Top users:</strong> ' +
          _(week.users)
            .first(7)
            .pluck('name')
            .map(formatUser)
            .value().join(', '));
      });
    });
  });
});
