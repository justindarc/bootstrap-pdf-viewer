;'use strict';

var PDFFormBuilder = function PDFFormBuilder(pdfViewer) {
  if (!(pdfViewer instanceof PDFViewer)) return console.error("Invalid instance of PDFViewer", pdfViewer);

  this._pdfViewer = pdfViewer;

  var $panel = this.$panel = $('<div class="pdf-form-builder-panel"/>').prependTo(pdfViewer.$viewerContainer);
  this.setFocusedFormField(null);

  var self = pdfViewer._formBuilder = this;

  pdfViewer.getFormBuilder = function() { return this._formBuilder; };

  var formLayer = this._formLayer = new PDFFormBuilderLayer(this);

  var scale = this._scale = { x: 1, y: 1 };

  var $navbarContainer = pdfViewer.$navbarContainer;
  var $navbarLeft = pdfViewer.$navbarLeft;

  $('<li><a href="#properties" rel="tooltip" title="Toggle Properties"><i class="icon-list-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#save" rel="tooltip" title="Save"><i class="icon-download-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#open" rel="tooltip" title="Open"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#label" rel="tooltip" title="Label"><i class="icon-font"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#textbox" rel="tooltip" title="Text Field"><i class="icon-edit"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#checkbox" rel="tooltip" title="Checkbox"><i class="icon-check"/></a></li>').appendTo($navbarLeft);
  
  $navbarContainer.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    var position = pdfViewer.getScrollView().getPosition();

    switch (href) {
      case '#properties':
        (function() {
          return (self._panelOpen) ? self.closePanel() : self.openPanel();
        })();
        break;
      case '#save':
        (function() {
          var serializedFields = JSON.stringify(self.serializeFields());
          window.alert(serializedFields);
        })();
        break;
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
      case '#label':
        (function() {
          var field = new PDFFormFieldLabel(formLayer, position.x + 50, position.y + 50);
        })();
        break;
      case '#textbox':
        (function() {
          var field = new PDFFormFieldTextBox(formLayer, position.x + 50, position.y + 50);
        })();
        break;
      case '#checkbox':
        (function() {
          var field = new PDFFormFieldCheckBox(formLayer, position.x + 50, position.y + 50);
        })();
        break;
      default:
        break;
    }
  });

  var isTouchSupported = !!('ontouchstart' in window);
  formLayer.$element.on(isTouchSupported ? 'touchstart' : 'mousedown', function(evt) {
    if (evt.isDefaultPrevented()) return;

    formLayer.$element.find('.pdf-form-field-focus').each(function(index, element) {
      var formField = element.formField;
      if (!formField) return;

      formField.setFocused(false);
    });
  });

  formLayer.$element.delegate('.pdf-form-field', isTouchSupported ? 'touchstart' : 'mousedown', function(evt) {
    var formField = this.formField;
    if (!formField) return;

    formField.setFocused(true);

    // Only forward the 'mousedown' event to prevent accidental drags when
    // scrolling on touchscreen devices.
    if (evt.type === 'mousedown') {
      formField._mouseDownHandler.call(formField.element, evt);
    }

    evt.preventDefault();
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

  $panel.on('change', function(evt) {
    var focusedFormField = self._focusedFormField;
    if (focusedFormField) focusedFormField.updateProperties();
  });

  $panel.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');

    switch (href) {
      case '#duplicate':
        (function() {
          var focusedFormField = self._focusedFormField;
          if (!focusedFormField) return;

          self.deserializeFields([focusedFormField.serializeField()]);
          focusedFormField.setFocused(true);
        })();
        break;
      case '#remove':
        (function() {
          var focusedFormField = self._focusedFormField;
          if (!focusedFormField) return;

          focusedFormField.remove();
          self.setFocusedFormField(null);
        })();
        break;
      default:
        break;
    }
  });
};

PDFFormBuilder.prototype = {
  constructor: PDFFormBuilder,

  $panel: null,

  _pdfViewer: null,
  _formLayer: null,

  _focusedFormField: null,

  getFocusedFormField: function() { return this._focusedFormField; },

  setFocusedFormField: function(formField) {
    this._focusedFormField = formField;

    if (formField) {
      this.$panel.html(
        '<h4>Properties</h4>' +
        '<form>' +
          '<ul>' +
            '<li>' +
              '<h5>' + formField.getType() + '</h5>' +
            '</li>' +
            formField.getPropertiesForm() +
            '<li>' +
              '<a class="btn btn-primary" href="#duplicate"><i class="icon-copy"/> Duplicate Field</a>' +
            '</li>' +
            '<li>' +
              '<a class="btn btn-danger" href="#remove"><i class="icon-trash"/> Remove Field</a>' +
            '</li>' +
          '</ul>' +
        '</form>'
      );
    }

    else {
      this.$panel.html(
        '<h4>Properties</h4>' +
        '<form>' +
          '<ul>' +
            '<li>' +
              '<h5>No form field selected</h5>' +
            '</li>' +
          '</ul>' +
        '</form>'
      );
    }
  },

  _scale: null,

  getScale: function() { return this._scale; },

  _panelOpen: false,

  getPanelOpen: function() { return this._panelOpen; },

  openPanel: function() {
    if (this._panelOpen) return;

    this._panelOpen = true;
    this.$panel.addClass('pdf-form-builder-panel-open');

    $(window).trigger('resize');
  },

  closePanel: function() {
    if (!this._panelOpen) return;

    this._panelOpen = false;
    this.$panel.removeClass('pdf-form-builder-panel-open');

    $(window).trigger('resize');
  },

  serializeFields: function() {
    var serializedFields = [];
    var formFields = this._formLayer._formFields;

    for (var i = 0, length = formFields.length; i < length; i++) {
      serializedFields.push(formFields[i].serializeField());
    }

    return serializedFields;
  },

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

var PDFFormBuilderLayer = function PDFFormBuilderLayer(formBuilder) {
  if (!(formBuilder instanceof PDFFormBuilder)) return console.error("Invalid instance of PDFFormBuilder", formBuilder);

  this._formBuilder = formBuilder;

  var $element = this.$element = $('<div class="pdf-form-builder-layer"/>').appendTo(formBuilder._pdfViewer.getScrollView().$content);
  var element  = this.element  = $element[0];

  var self = element.formLayer = this;

  var formFields = this._formFields = [];
};

PDFFormBuilderLayer.prototype = {
  constructor: PDFFormBuilderLayer,

  _pdfViewer: null,
  _formBuilder: null,

  element: null,
  $element: null,

  _formFields: null,

  getFormFields: function() { return this._formFields; }
};
