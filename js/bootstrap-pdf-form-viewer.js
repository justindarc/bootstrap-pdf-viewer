;'use strict';

var PDFFormViewer = function PDFFormViewer(viewer, options) {
  if (!(viewer instanceof PDFViewer)) return console.error('Invalid instance of PDFViewer', viewer);

  options = options || {};

  this._viewer = viewer;

  var self = viewer._formViewer = this;

  viewer.getFormViewer = function() { return this._formViewer; };

  var $element = viewer.$element;
  $element.addClass('pdf-form-viewer');

  var $style = this.$style = $('<style/>').appendTo(document.body);

  var toolbarActions = this._toolbarActions = {};

  var $navbar = viewer.$navbar;
  var $navbarLeft = viewer.$navbarLeft;

  if (!options.hideOpenFormButton) $('<li><a href="#open-form" rel="tooltip" title="Open Form"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);
  if (!options.hideOpenFormButton) $('<li class="divider"/>').appendTo($navbarLeft);
  if (!options.hideOpenDataButton) $('<li><a href="#open-data" rel="tooltip" title="Open Data"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);
  if (!options.hideSaveDataButton) $('<li><a href="#save-data" rel="tooltip" title="Save Data"><i class="icon-save"/></a></li>').appendTo($navbarLeft);

  $navbar.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    var position = viewer.getScrollView().getPosition();

    if (typeof toolbarActions[href] === 'function') {
      toolbarActions[href].call(self);
      return;
    }

    switch (href) {
      case '#open-form':
        (function() {
          var serializedFormLayers = window.prompt('Enter Form Layer data in JSON format:\n\n(or press "OK" to load sample form)');
          if (serializedFormLayers === null) return;

          serializedFormLayers = $.trim(serializedFormLayers);
          if (serializedFormLayers) {
            self.deserializeFormLayers(JSON.parse(serializedFormLayers), true);
          }

          else {
            $.getJSON('data/form.json', function(data) {
              self.deserializeFormLayers(data, true);
            });
          }
        })();
        break;
      case '#open-data':
        (function() {
          var serializedValues = window.prompt('Enter Form Value data in JSON format:\n\n(or press "OK" to load sample submission)');
          if (serializedValues === null) return;

          serializedValues = $.trim(serializedValues);
          if (serializedValues) {
            self.deserializeValues(JSON.parse(serializedValues));
          }

          else {
            $.getJSON('data/submission.json', function(data) {
              self.deserializeValues(data);
            });
          }
        })();
        break;
      case '#save-data':
        (function() {
          var serializedValues = JSON.stringify(self.serializeValues());
          window.alert(serializedValues);
        })();
        break;
      default:
        break;
    }
  });

  $element.on(PDFViewer.EventType.ScaleChange, function(evt) {
    $style.html(
      '.pdf-form-field > input,' +
      '.pdf-form-field > label,' +
      '.pdf-form-field > textarea {' +
        'font-size: ' + (evt.calculatedScale * 100) + '%;' +
      '}'
    );
  });

  // Wait for the PDFViewer to become ready before initializing the page layers.
  viewer.$element.on(PDFViewer.EventType.Ready, function(evt) {
    self.init();
  });
};

PDFFormViewer.prototype = {
  constructor: PDFFormViewer,

  $style: null,

  _viewer: null,

  init: function() {
    var viewer = this._viewer;
    var pageViews = viewer.getPageViews();
    
    var formLayers = this._formLayers = [];

    for (var i = 0, length = pageViews.length; i < length; i++) {
      formLayers.push(new PDFFormLayer(viewer, pageViews[i]));
    }
  },

  _toolbarActions: null,

  setToolbarAction: function(action, callback) {
    this._toolbarActions[action] = callback;
  },

  _focusedFormField: null,

  getFocusedFormField: function() { return this._focusedFormField; },

  setFocusedFormField: function(formField) {
    this._focusedFormField = formField;
  },

  getFormFieldById: function(id) {
    var formLayers = this._formLayers;
    for (var i = 0, length = formLayers.length, formField; i < length; i++) {
      formField = formLayers[i].getFormFieldById(id);
      if (formField) return formField;
    }

    return null;
  },

  removeAllFormFields: function() {
    var formLayers = this._formLayers;
    for (var i = 0, length = formLayers.length; i < length; i++) {
      formLayers[i].removeAllFormFields();
    }
  },

  deserializeFormLayers: function(serializedFormLayers, replaceExistingFields) {
    if (replaceExistingFields) this.removeAllFormFields();

    var formLayers = this._formLayers;

    for (var index in serializedFormLayers) {
      formLayers[index].deserializeFormFields(serializedFormLayers[index], replaceExistingFields);
    }
  },

  serializeValues: function() {
    var serializedValues = {};

    var formLayers = this._formLayers;
    var length = formLayers.length;
    if (length === 0) return serializedFormLayers;

    for (var i = 0, serializedFormLayerValues, id; i < length; i++) {
      serializedFormLayerValues = formLayers[i].serializeValues();

      for (id in serializedFormLayerValues) {
        serializedValues[id] = {
          value: serializedFormLayerValues[id]
        };
      }
    }

    return serializedValues;
  },

  deserializeValues: function(serializedValues) {
    var serializedValue, formField;
    for (var id in serializedValues) {
      if (!(formField = this.getFormFieldById(id))) continue;

      serializedValue = serializedValues[id];

      formField.setValue(serializedValue.value);
    }
  }
};
