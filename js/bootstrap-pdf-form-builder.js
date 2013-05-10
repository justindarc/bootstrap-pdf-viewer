;'use strict';

var PDFFormBuilder = function PDFFormBuilder(pdfViewer) {
  if (!(pdfViewer instanceof PDFViewer)) return console.error("Invalid instance of PDFViewer", pdfViewer);

  this._pdfViewer = pdfViewer;

  var $navbarContainer = pdfViewer.$navbarContainer;
  var $navbarLeft = pdfViewer.$navbarLeft;

  $('<li class="divider"/>').appendTo($navbarLeft);

  $('<li><a href="#text-field" rel="tooltip" title="Text Field"><i class="icon-edit"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#checkbox" rel="tooltip" title="Checkbox"><i class="icon-check"/></a></li>').appendTo($navbarLeft);
  
  $navbarContainer.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    
    switch (href) {
      case '#text-field':
        (function() {
          var field = new PDFFormField(pdfViewer);
        })();
        break;
      case '#checkbox':
        (function() {
          var field = new PDFFormField(pdfViewer);
        })();
        break;
      default:
        break;
    }
  });
};

PDFFormBuilder.prototype = {
  constructor: PDFFormBuilder,

  _pdfViewer: null
};

var PDFFormField = function PDFFormField(pdfViewer) {
  if (!(pdfViewer instanceof PDFViewer)) return console.error("Invalid instance of PDFViewer", pdfViewer);

  this._pdfViewer = pdfViewer;

  var $element = this.$element = $('<div class="pdf-form-field"/>').appendTo(pdfViewer.$pageViewContainer);
};

PDFFormField.prototype = {
  constructor: PDFFormField,

  _pdfViewer: null,

  $element: null
};
