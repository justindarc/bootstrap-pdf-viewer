;'use strict';

var PDFFormBuilder = function PDFFormBuilder(viewer, options) {
  if (!(viewer instanceof PDFViewer)) return console.error('Invalid instance of PDFViewer', viewer);

  options = options || {};

  this._viewer = viewer;

  var self = viewer._formBuilder = this;

  viewer.getFormBuilder = function() { return this._formBuilder; };

  var $element = viewer.$element;
  $element.addClass('pdf-form-builder');

  var $style = this.$style = $('<style/>').appendTo(document.body);
  var $panel = this.$panel = $('<div class="pdf-form-builder-panel"/>').prependTo(viewer.$viewerContainer);

  var toolbarActions = this._toolbarActions = {};

  var $navbar = viewer.$navbar;
  var $navbarLeft = viewer.$navbarLeft;

  $('<li><a href="#properties" rel="tooltip" title="Toggle Properties"><i class="icon-list-alt"/></a></li>').appendTo($navbarLeft);
  $('<li class="divider"/>').appendTo($navbarLeft);
  if (!options.hideOpenFormButton) $('<li><a href="#open-form" rel="tooltip" title="Open Form"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);
  if (!options.hideSaveFormButton) $('<li><a href="#save-form" rel="tooltip" title="Save Form"><i class="icon-save"/></a></li>').appendTo($navbarLeft);
  if (!options.hideOpenFormButton && !options.hideSaveFormButton) $('<li class="divider"/>').appendTo($navbarLeft);
  $('<li><a href="#label" rel="tooltip" title="Label"><i class="icon-font"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#textbox" rel="tooltip" title="Text Field"><i class="icon-edit"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#textarea" rel="tooltip" title="Text Area"><i class="icon-comments-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#checkbox" rel="tooltip" title="Checkbox"><i class="icon-check"/></a></li>').appendTo($navbarLeft);
  $('<li class="divider"/>').appendTo($navbarLeft);
  $('<li><a href="#snap-to-grid" rel="tooltip" title="Snap To Grid"><i class="icon-th"/></a></li>').appendTo($navbarLeft);

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
      case '#properties':
        (function() {
          return (self._panelOpen) ? self.closePanel() : self.openPanel();
        })();
        break;
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
      case '#save-form':
        (function() {
          var serializedFormLayers = JSON.stringify(self.serializeFormLayers());
          window.alert(serializedFormLayers);
        })();
        break;
      case '#label':
        (function() {
          self.getCurrentFormLayer().addFormField(new PDFFormFieldLabel());
        })();
        break;
      case '#textbox':
        (function() {
          self.getCurrentFormLayer().addFormField(new PDFFormFieldTextBox());
        })();
        break;
      case '#textarea':
        (function() {
          self.getCurrentFormLayer().addFormField(new PDFFormFieldTextArea());
        })();
        break;
      case '#checkbox':
        (function() {
          self.getCurrentFormLayer().addFormField(new PDFFormFieldCheckBox());
        })();
        break;
      case '#snap-to-grid':
        (function() {
          var snapToGrid = !self.getSnapToGrid();
          self.setSnapToGrid(snapToGrid);

          if (snapToGrid) {
            $button.parent().addClass('active');
          }

          else {
            $button.parent().removeClass('active');
          }
        })();
      default:
        break;
    }
  });

  $element.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', function(evt) {
    if (evt.isDefaultPrevented()) return;

    if ($(evt.target).closest('.pdf-form-builder-panel')[0]) return;

    var focusedFormField = self._focusedFormField;
    if (focusedFormField) focusedFormField.setFocused(false);
  });

  $element.delegate('.pdf-form-field', PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', function(evt) {
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

  $element.on(PDFViewer.EventType.ScaleChange, function(evt) {
    $style.html(
      '.pdf-form-field > input,' +
      '.pdf-form-field > label,' +
      '.pdf-form-field > textarea {' +
        'font-size: ' + (evt.calculatedScale * 100) + '%;' +
      '}'
    );
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

          var formLayerIndex = self.getIndexOfFormLayer(focusedFormField.getFormLayer());
          if (formLayerIndex === -1) formLayerIndex = viewer.getCurrentPageIndex();

          var serializedFormLayers = {};
          var serializedFormFields = serializedFormLayers[formLayerIndex] = {};
          
          serializedFormFields[PDFFormField.generateUniqueId()] = focusedFormField.serializeFormField();

          self.deserializeFormLayers(JSON.parse(JSON.stringify(serializedFormLayers)));
        })();
        break;
      case '#remove':
        (function() {
          var focusedFormField = self._focusedFormField;
          if (!focusedFormField) return;

          var formLayer = focusedFormField.getFormLayer();
          formLayer.removeFormField(focusedFormField);
          
          self.setFocusedFormField(null);
        })();
        break;
      default:
        break;
    }
  });

  this.setFocusedFormField(null);

  // Wait for the PDFViewer to become ready before initializing the page layers.
  viewer.$element.on(PDFViewer.EventType.Ready, function(evt) {
    self.init();
  });
};

PDFFormBuilder.prototype = {
  constructor: PDFFormBuilder,

  $panel: null,
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

  _snapToGrid: false,

  getSnapToGrid: function() { return this._snapToGrid; },

  setSnapToGrid: function(snapToGrid) {
    this._snapToGrid = snapToGrid;
  },

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

  _formLayers: null,

  getFormLayers: function() { return this._formLayers; },

  getCurrentFormLayer: function() { return this._formLayers[this._viewer.getCurrentPageIndex()]; },

  getIndexOfFormLayer: function(formLayer) {
    var formLayers = this._formLayers;
    for (var i = 0, length = formLayers.length; i < length; i++) {
      if (formLayers[i] === formLayer) return i;
    }

    return -1;
  },

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
              '<h5>' + formField.DESCRIPTIVE_TYPE + '</h5>' +
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

  removeAllFormFields: function() {
    var formLayers = this._formLayers;
    for (var i = 0, length = formLayers.length; i < length; i++) {
      formLayers[i].removeAllFormFields();
    }
  },

  serializeFormLayers: function() {
    var serializedFormLayers = {};

    var formLayers = this._formLayers;
    var length = formLayers.length;
    if (length === 0) return serializedFormLayers;

    for (var i = 0, serializedFormFields; i < length; i++) {
      serializedFormFields = formLayers[i].serializeFormFields();
      if (!serializedFormFields) continue;

      serializedFormLayers[i] = serializedFormFields;
    }

    return serializedFormLayers;
  },

  deserializeFormLayers: function(serializedFormLayers, replaceExistingFields) {
    var focusedFormField = this._focusedFormField;
    if (focusedFormField) focusedFormField.setFocused(false);

    if (replaceExistingFields) this.removeAllFormFields();

    var formLayers = this._formLayers;

    for (var index in serializedFormLayers) {
      formLayers[index].deserializeFormFields(serializedFormLayers[index], replaceExistingFields);
    }
  }
};
