require('chai').should();

var processing = require('../processing');

describe('getTitle', function () {
  it('should get the title', function () {
    var html = '<html>' +
      '<head>' +
        '<title>Hurr Derp</title>' +
      '</head>' +
      '<body>' +
      '</body>' +
    '</html>';

    processing.getTitle(html).should.equal('Hurr Derp');
  });

  it('should not error on undefined body', function () {
    processing.getTitle(undefined).should.equal('');
  });
});
