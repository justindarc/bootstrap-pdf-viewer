;'use strict';

var PDFFormBuilder = function PDFFormBuilder(viewer) {
  if (!(viewer instanceof PDFViewer)) return console.error('Invalid instance of PDFViewer', viewer);

  this._viewer = viewer;

  var self = viewer._formBuilder = this;

  viewer.getFormBuilder = function() { return this._formBuilder; };

  var $element = viewer.$element;
  $element.addClass('pdf-form-builder');

  var $style = this.$style = $('<style/>').appendTo(document.body);
  var $panel = this.$panel = $('<div class="pdf-form-builder-panel"/>').prependTo(viewer.$viewerContainer);

  var $navbarContainer = viewer.$navbarContainer;
  var $navbarLeft = viewer.$navbarLeft;

  $('<li><a href="#properties" rel="tooltip" title="Toggle Properties"><i class="icon-list-alt"/></a></li>').appendTo($navbarLeft);
  $('<li class="divider"/>').appendTo($navbarLeft);
  $('<li><a href="#open-form" rel="tooltip" title="Open Form"><i class="icon-upload-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#save-form" rel="tooltip" title="Save Form"><i class="icon-save"/></a></li>').appendTo($navbarLeft);
  $('<li class="divider"/>').appendTo($navbarLeft);
  $('<li><a href="#label" rel="tooltip" title="Label"><i class="icon-font"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#textbox" rel="tooltip" title="Text Field"><i class="icon-edit"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#textarea" rel="tooltip" title="Text Area"><i class="icon-comments-alt"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#checkbox" rel="tooltip" title="Checkbox"><i class="icon-check"/></a></li>').appendTo($navbarLeft);
  $('<li class="divider"/>').appendTo($navbarLeft);
  $('<li><a href="#snap-to-grid" rel="tooltip" title="Snap To Grid"><i class="icon-th"/></a></li>').appendTo($navbarLeft);

  $navbarContainer.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    var position = viewer.getScrollView().getPosition();

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

var PDFFormLayer = function PDFFormLayer(viewer, pageView) {
  if (!(viewer   instanceof PDFViewer        )) return console.error('Invalid instance of PDFViewer', viewer);
  if (!(pageView instanceof PDFViewerPageView)) return console.error('Invalid instance of PDFViewerPageView', pageView);

  this._viewer   = viewer;
  this._pageView = pageView;

  var $element = this.$element = $('<div class="pdf-form-layer"/>').prependTo(pageView.$element);

  var formFields = this._formFields = [];
};

PDFFormLayer.prototype = {
  constructor: PDFFormLayer,

  $element: null,

  _viewer: null,

  getViewer: function() { return this._viewer; },

  _pageView: null,

  getPageView: function() { return this._pageView; },

  getFormBuilder: function() { return this._viewer.getFormBuilder(); },

  _formFields: null,

  getFormFields: function() { return this._formFields; },

  getFormFieldById: function(id) {
    var formFields = this._formFields;
    for (var i = 0, length = formFields.length, formField; i < length; i++) {
      if ((formField = formFields[i]) && formField.getId() == id) return formField;
    }

    return null;
  },

  addFormField: function(formField) {
    this._formFields.push(formField);
    this.$element.append(formField.$element);

    formField._formLayer = this;

    formField.setFocused(true);
  },

  removeFormField: function(formField) {
    var formFields = this._formFields;
    for (var i = 0, length = formFields.length; i < length; i++) {
      if (formFields[i] === formField) {
        formFields.splice(i, 1);
        formField.$element.remove();

        formField._formLayer = null;
        return;
      }
    }
  },

  removeAllFormFields: function() {
    var formFields = this._formFields;
    for (var i = 0, length = formFields.length, formField; i < length; i++) {
      formField = formFields[i];

      formField.$element.remove();
      formField._formLayer = null;
    }

    formFields.length = 0;
  },

  convertPositionToPercentage: function(position) {
    var pageView = this._pageView;
    var viewer   = pageView._viewer;
    var scale    = viewer._lastCalculatedScale;

    return {
      x: (position.x / pageView._actualWidth ) * 100 / scale,
      y: (position.y / pageView._actualHeight) * 100 / scale
    };
  },

  serializeFormFields: function() {
    var formFields = this._formFields;
    var length = formFields.length;
    if (length === 0) return null;

    var serializedFormFields = {};

    for (var i = 0, serializedFormField, id; i < length; i++) {
      serializedFormField = formFields[i].serializeFormField();
      id = serializedFormField.id;

      delete serializedFormField.id;

      serializedFormFields[id] = serializedFormField;
    }

    return serializedFormFields;
  },

  deserializeFormFields: function(serializedFormFields, replaceExistingFields) {
    if (replaceExistingFields) this.removeAllFormFields();

    var formLayers = this._formLayers;

    var serializedFormField, formField;
    for (var id in serializedFormFields) {
      serializedFormField = serializedFormFields[id];
      serializedFormField.id = id;

      this.addFormField(formField = PDFFormField.deserializeFormField(serializedFormField));
      if (replaceExistingFields) formField.setFocused(false);
    }
  }
};

var PDFFormField = function PDFFormField(x, y, w, h) {
  var $element = this.$element = $('<div class="pdf-form-field"/>');
  var $input   = this.$input   = $('<input type="hidden"/>');
  var $handles = this.$handles = {
    N : $('<div class="pdf-form-field-handle pdf-form-field-handle-n"/>' ).appendTo($element),
    NE: $('<div class="pdf-form-field-handle pdf-form-field-handle-ne"/>').appendTo($element),
    E : $('<div class="pdf-form-field-handle pdf-form-field-handle-e"/>' ).appendTo($element),
    SE: $('<div class="pdf-form-field-handle pdf-form-field-handle-se"/>').appendTo($element),
    S : $('<div class="pdf-form-field-handle pdf-form-field-handle-s"/>' ).appendTo($element),
    SW: $('<div class="pdf-form-field-handle pdf-form-field-handle-sw"/>').appendTo($element),
    W : $('<div class="pdf-form-field-handle pdf-form-field-handle-w"/>' ).appendTo($element),
    NW: $('<div class="pdf-form-field-handle pdf-form-field-handle-nw"/>').appendTo($element)
  };

  for (var handleType in $handles) {
    var handle = $handles[handleType][0];
    handle.formField = self;
    handle.handleType = PDFFormField.HandleType[handleType];
  }

  var self = $element[0].formField = this;

  var id = this._id = PDFFormField.generateUniqueId();

  var properties = this._properties = {
    attributes: {},
    styles: {
      element: {},
      input: {}
    }
  };

  var position = this._position = {
    x: x || (50 - (this.DEFAULT_WIDTH  / 2)),
    y: y || (50 - (this.DEFAULT_HEIGHT / 2))
  };

  var size = this._size = {
    w: w || this.DEFAULT_WIDTH,
    h: h || this.DEFAULT_HEIGHT
  };

  this.setPosition(position.x, position.y);
  this.setSize(size.w, size.h);
};

PDFFormField.EventType = {
  Focus:  'PDFFormField:Focus',
  Blur:   'PDFFormField:Blur',
  Resize: 'PDFFormField:Resize',
  Move:   'PDFFormField:Move'
};

PDFFormField.HandleType = { N: 'n', NE: 'ne', E: 'e', SE: 'se', S: 's', SW: 'sw', W: 'w', NW: 'nw' };

PDFFormField.deserializeFormField = function(serializedFormField) {
  var formFieldClass = window[serializedFormField.type] || PDFFormField;
  
  var position = serializedFormField.position;
  var size     = serializedFormField.size;

  var formField = new formFieldClass(position.x, position.y, size.w, size.h);
  
  formField.setProperties(serializedFormField.properties);
  formField._id = serializedFormField.id;

  return formField;
};

PDFFormField.generateUniqueId = function() {
  var lastTimestamp = new Date().getTime();
  var newTimestamp = new Date().getTime();

  while (newTimestamp === lastTimestamp) {
    newTimestamp = new Date().getTime();
  }

  return newTimestamp + '';
};

PDFFormField.prototype = {
  constructor: PDFFormField,

  DESCRIPTIVE_TYPE: 'Field',

  DEFAULT_WIDTH:  10,
  DEFAULT_HEIGHT: 2,

  $element: null,
  $input: null,
  $handles: null,

  _isMoving: false,
  _isResizing: false,

  _activeHandle: null,

  _lastMousePosition: null,
  _lastTouchIdentifier: null,

  _mouseDownHandler: function(evt) {
    var $target = $(evt.target);
    var $window = $(window);

    var formField = evt.target.formField;
    if (!formField) formField = $target.closest('.pdf-form-field')[0].formField;

    if ($target.hasClass('pdf-form-field-handle')) {
      formField._isResizing = true;
      formField._activeHandle = evt.target.handleType;
    }

    else {
      formField._isMoving = true;
    }

    var formLayer = formField._formLayer;

    formField._lastMousePosition = PDFViewer.Util.getPositionForEvent(evt);
    formField._lastTouchIdentifier = PDFViewer.IS_TOUCH_SUPPORTED ? evt.originalEvent.targetTouches[0].identifier : null;

    var mouseMoveHandler = function(evt) {
      var isMoving   = formField._isMoving;
      var isResizing = formField._isResizing;
      if (!isMoving && !isResizing) return;

      var mousePosition = PDFViewer.Util.getPositionForEvent(evt, formField._lastTouchIdentifier);
      var mouseDelta    = PDFViewer.Util.getDeltaForPositions(mousePosition, formField._lastMousePosition);

      mouseDelta = formLayer.convertPositionToPercentage(mouseDelta);

      if (isMoving) {
        formField.addToPosition(mouseDelta.x, mouseDelta.y);
      }

      else if (isResizing) {
        switch (formField._activeHandle) {
          case PDFFormField.HandleType.N:
            formField.addToSize(0, -mouseDelta.y);
            formField.addToPosition(0, mouseDelta.y);
            break;
          case PDFFormField.HandleType.NE:
            formField.addToSize(mouseDelta.x, -mouseDelta.y);
            formField.addToPosition(0, mouseDelta.y);
            break;
          case PDFFormField.HandleType.E:
            formField.addToSize(mouseDelta.x, 0);
            break;
          case PDFFormField.HandleType.SE:
            formField.addToSize(mouseDelta.x, mouseDelta.y);
            break;
          case PDFFormField.HandleType.S:
            formField.addToSize(0, mouseDelta.y);
            break;
          case PDFFormField.HandleType.SW:
            formField.addToSize(-mouseDelta.x, mouseDelta.y);
            formField.addToPosition(mouseDelta.x, 0);
            break;
          case PDFFormField.HandleType.W:
            formField.addToSize(-mouseDelta.x, 0);
            formField.addToPosition(mouseDelta.x, 0);
            break;
          case PDFFormField.HandleType.NW:
            formField.addToSize(-mouseDelta.x, -mouseDelta.y);
            formField.addToPosition( mouseDelta.x, mouseDelta.y);
            break;
          default:
            break;
        }
      }

      formField._lastMousePosition = mousePosition;

      evt.preventDefault();
      evt.stopImmediatePropagation();
    };

    var mouseUpHandler = function(evt) {
      formField._isMoving = formField._isResizing = false;
      formField._activeHandle = null;

      $window.off(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchmove' : 'mousemove', mouseMoveHandler);
      $window.off(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchend'  : 'mouseup'  , mouseUpHandler);
    };

    $window.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchmove' : 'mousemove', mouseMoveHandler);
    $window.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchend'  : 'mouseup'  , mouseUpHandler);

    evt.preventDefault();
  },

  _formLayer: null,

  getFormLayer: function() { return this._formLayer; },

  _id: '',

  getId: function() { return this._id; },

  _properties: null,

  getProperties: function() { return this._properties; },

  setProperties: function(properties) {
    this._properties = properties || {};
    this.updateInput();
  },

  updateProperties: function() {
    var formBuilder = this._formLayer.getFormBuilder();
    var properties  = this._properties;

    var $panel = formBuilder.$panel;
    var $form  = $panel.find('form');

    var values = $form.serializeArray();

    var i, length, name, value;

    for (i = 0, length = values.length, name, value; i < length; i++) {
      name  = values[i].name;
      value = values[i].value;

      if (name.indexOf('styles.') === 0) {
        value += $form.find('[name="' + name + '"]').attr('data-value-suffix') || '';
        name = name.substr(7).split('.');
        properties.styles[name[0]][name[1]] = value;
      }

      else if (name.indexOf('attributes.') === 0) {
        if (value === 'true' ) value = true;
        if (value === 'false') value = false;

        name = name.substr(11);
        properties.attributes[name] = value;
      }

      else {
        properties[name] = value;
      }
    }

    this.updateInput();
  },

  updateInput: function() {
    var $element   = this.$element;
    var $input     = this.$input;
    var properties = this._properties;
    var styles     = properties.styles;
    var attributes = properties.attributes;

    var name, value;

    for (name in properties) {
      value = properties[name];

      if (name === 'html') {
        $input.html(value);
      }
    }

    $element.css(styles.element);
    $input.css(styles.input);

    for (name in attributes) {
      value = attributes[name];

      if (typeof value === 'boolean') {
        $input.prop(name, value);
      }

      else if (!value) {
        $input.removeAttr(name);
      }
      
      else {
        $input.attr(name, value);
      }
    }
  },

  getPropertiesForm: function() { return ''; },

  _focused: false,

  getFocused: function() { return this._focused; },

  setFocused: function(focused) {
    if (this._focused === focused) return;
    
    var formBuilder = this._formLayer.getFormBuilder();
    var properties  = this._properties;
    
    var $element = this.$element;
    if (!$element) return;

    // Check if this form field is losing focus
    if (this._focused && !focused) {
      this.updateProperties();
    }

    var lastFocusedFormField = formBuilder.getFocusedFormField();

    if ((this._focused = focused)) {
      if (lastFocusedFormField && lastFocusedFormField !== this) {
        lastFocusedFormField.setFocused(false);
      }
      
      formBuilder.setFocusedFormField(this);
      
      $element.addClass('pdf-form-field-focus');
      $element.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', this._mouseDownHandler);
    
      $element.trigger($.Event(PDFFormField.EventType.Focus, {
        formField: this
      }));
    }

    else {
      formBuilder.setFocusedFormField(null);

      $element.removeClass('pdf-form-field-focus');
      $element.off(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', this._mouseDownHandler);

      $element.trigger($.Event(PDFFormField.EventType.Blur, {
        formField: this
      }));
    }
  },

  _position: null, // { x: 0, y: 0 }

  getPosition: function() { return this._position; },

  setPosition: function(x, y) {
    var $element = this.$element;
    var formLayer = this._formLayer;
    var snapToGrid = !!formLayer && formLayer.getFormBuilder().getSnapToGrid();
    var position = this._position;

    position.x = x;
    position.y = y;

    $element.css({
      left: (snapToGrid ? Math.round(position.x) : position.x) + '%',
      top:  (snapToGrid ? Math.round(position.y) : position.y) + '%'
    });

    $element.trigger($.Event(PDFFormField.EventType.Move, {
      formField: this
    }));
  },

  addToPosition: function(deltaX, deltaY) {
    var position = this._position;
    this.setPosition(position.x + deltaX, position.y + deltaY);
  },

  _size: null, // { w: 0, h: 0 }

  getSize: function() { return this._size; },

  setSize: function(w, h) {
    var $element = this.$element;
    var formLayer = this._formLayer;
    var snapToGrid = !!formLayer && formLayer.getFormBuilder().getSnapToGrid();
    var size = this._size;

    size.w = w;
    size.h = h;

    $element.css({
      width:  (snapToGrid ? Math.round(size.w) : size.w) + '%',
      height: (snapToGrid ? Math.round(size.h) : size.h) + '%'
    });

    $element.trigger($.Event(PDFFormField.EventType.Resize, {
      formField: this
    }));
  },

  addToSize: function(deltaW, deltaH) {
    var size = this._size;
    this.setSize(size.w + deltaW, size.h + deltaH);
  },

  getClassName: function() {
    var matches = this.constructor.toString().match(/function\s*(\w+)/);
    return matches.length === 2 ? matches[1] : 'PDFFormField';
  },

  serializeFormField: function() {
    var formLayer = this._formLayer;
    var snapToGrid = !!formLayer && formLayer.getFormBuilder().getSnapToGrid();

    var position = this._position;
    var size     = this._size;

    position.x = snapToGrid ? Math.round(position.x) : position.x;
    position.y = snapToGrid ? Math.round(position.y) : position.y;

    size.w = snapToGrid ? Math.round(size.w) : size.w;
    size.h = snapToGrid ? Math.round(size.h) : size.h;

    return {
      id:         this._id,
      type:       this.getClassName(),
      position:   position,
      size:       size,
      properties: this._properties
    };
  },

  serializeValue: function() {
    return {
      id:    this._id,
      value: this.getValue()
    };
  }
};
