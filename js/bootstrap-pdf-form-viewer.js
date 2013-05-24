;'use strict';

var PDFFormViewer = function PDFFormViewer(pdfViewer) {
  if (!(pdfViewer instanceof PDFViewer)) return console.error("Invalid instance of PDFViewer", pdfViewer);

  this._pdfViewer = pdfViewer;

  var self = pdfViewer._formViewer = this;

  pdfViewer.getFormViewer = function() { return this._formViewer; };

  var formLayer = this._formLayer = new PDFFormViewerLayer(this);

  var scale = this._scale = { x: 1, y: 1 };

  var $navbarContainer = pdfViewer.$navbarContainer;
  var $navbarLeft = pdfViewer.$navbarLeft;

  $('<li><a href="#open" rel="tooltip" title="Open"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);

  $navbarContainer.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');

    switch (href) {
      case '#open':
        (function() {
          var serializedFields = window.prompt('Enter Form Field data in JSON format:\n\n(or press "OK" to load sample form)');
          if (serializedFields === null) return;

          serializedFields = $.trim(serializedFields);
          if (serializedFields) {
            self.deserializeFields(JSON.parse(serializedFields), true);
          }

          else {
            $.getJSON('data/form.json', function(data) {
              self.deserializeFields(data, true);
            });
          }
        })();
        break;
      default:
        break;
    }
  });

  pdfViewer.$element.on(PDFViewer.EventType.ScaleChange, function(evt) {
    var width  = pdfViewer.getActualWidth();
    var height = pdfViewer.getActualHeight();
    var margin = pdfViewer.getNumberOfPages() * 10;
    var scaleX = scale.x = evt.calculatedScale;
    var scaleY = scale.y = ((height * scaleX) + margin) / height;

    formLayer.$element.css({
      'margin-left': '-' + (width  / 2) + 'px',
      'width':  width  + 'px',
      'height': height + 'px',
      '-webkit-transform': 'scale(' + scaleX + ',' + scaleY + ')',
         '-moz-transform': 'scale(' + scaleX + ',' + scaleY + ')',
          '-ms-transform': 'scale(' + scaleX + ',' + scaleY + ')',
           '-o-transform': 'scale(' + scaleX + ',' + scaleY + ')',
              'transform': 'scale(' + scaleX + ',' + scaleY + ')'
    });
  });
};

PDFFormViewer.prototype = {
  constructor: PDFFormViewer,

  _pdfViewer: null,
  _formLayer: null,

  _scale: null,

  getScale: function() { return this._scale; },

  deserializeFields: function(serializedFields, replaceExistingFields) {
    var formLayer = this._formLayer;

    var focusedFormField = this._focusedFormField;
    if (focusedFormField) focusedFormField.setFocused(false);

    if (replaceExistingFields) (function() {
      var formFields = formLayer._formFields;
      while (formFields.length > 0) formFields[0].remove();
    })();

    for (var i = 0, length = serializedFields.length; i < length; i++) {
      PDFFormField.deserializeField(formLayer, serializedFields[i]);
    }
  }
};

var PDFFormViewerLayer = function PDFFormViewerLayer(formViewer) {
  if (!(formViewer instanceof PDFFormViewer)) return console.error("Invalid instance of PDFFormViewer", formViewer);

  this._formViewer = formViewer;

  var $element = this.$element = $('<div class="pdf-form-viewer-layer"/>').appendTo(formViewer._pdfViewer.getScrollView().$content);
  var element  = this.element  = $element[0];

  var self = element.formLayer = this;

  var formFields = this._formFields = [];
};

PDFFormViewerLayer.prototype = {
  constructor: PDFFormViewerLayer,

  _pdfViewer: null,
  _formViewer: null,

  element: null,
  $element: null,

  _formFields: null,

  getFormFields: function() { return this._formFields; }
};
