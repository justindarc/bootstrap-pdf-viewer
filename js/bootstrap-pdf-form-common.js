;'use strict';

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

  getFormBuilder: function() {
    if (!this._viewer.getFormBuilder) return null;
    return this._viewer.getFormBuilder();
  },

  getFormViewer: function() {
    if (!this._viewer.getFormViewer) return null;
    return this._viewer.getFormViewer();
  },

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
  },

  serializeValues: function() {
    var formFields = this._formFields;
    var length = formFields.length;
    if (length === 0) return null;

    var serializedValues = {};

    for (var i = 0, serializedValue, id; i < length; i++) {
      serializedValue = formFields[i].serializeValue();

      serializedValues[serializedValue.id] = serializedValue.value;
    }

    return serializedValues;
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
    if (!formBuilder) return;
    
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
    
    var form = this._formLayer.getFormBuilder() || this._formLayer.getFormViewer();
    if (!form) return console.error('Cannot set focus; No PDFFormBuilder or PDFFormViewer is associated with the PDFFormLayer');

    var properties  = this._properties;
    
    var $element = this.$element;
    if (!$element) return;

    // Check if this form field is losing focus
    if (this._focused && !focused) {
      this.updateProperties();
    }

    var lastFocusedFormField = form.getFocusedFormField();

    if ((this._focused = focused)) {
      if (lastFocusedFormField && lastFocusedFormField !== this) {
        lastFocusedFormField.setFocused(false);
      }
      
      form.setFocusedFormField(this);
      
      $element.addClass('pdf-form-field-focus');
      $element.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', this._mouseDownHandler);
    
      $element.trigger($.Event(PDFFormField.EventType.Focus, {
        formField: this
      }));
    }

    else {
      form.setFocusedFormField(null);

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
    var formBuilder = formLayer ? formLayer.getFormBuilder() : null;
    var snapToGrid = !!formBuilder && formBuilder.getSnapToGrid();
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
    var formBuilder = formLayer ? formLayer.getFormBuilder() : null;
    var snapToGrid = !!formBuilder && formBuilder.getSnapToGrid();
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
    var formBuilder = formLayer ? formLayer.getFormBuilder() : null;
    var snapToGrid = !!formBuilder && formBuilder.getSnapToGrid();

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
  },

  getValue: function() { return this.$input.val(); },

  setValue: function(value) {
    this.$input.val(value);
  }
};

var PDFFormFieldLabel = function PDFFormFieldLabel(x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  this.$input = $('<label/>').appendTo(this.$element);
};

PDFFormFieldLabel.prototype = new PDFFormField();
PDFFormFieldLabel.prototype.constructor = PDFFormFieldLabel;
PDFFormFieldLabel.prototype.DESCRIPTIVE_TYPE = 'Label';
PDFFormFieldLabel.prototype.DEFAULT_WIDTH  = 10;
PDFFormFieldLabel.prototype.DEFAULT_HEIGHT = 2;

PDFFormFieldLabel.prototype.getPropertiesForm = function() {
  var properties = this._properties;
  var html = '' +
    '<li>' +
      '<label>Text:</label>' +
      '<input type="text" name="html" value="' + (properties.html || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Font Size:</label>' +
      '<input type="number" name="styles.element.font-size" data-value-suffix="px" value="' + window.parseInt(properties.styles.element['font-size'] || '12', 10) + '"/>' +
    '</li>';

  return html;
};

PDFFormFieldLabel.prototype.serializeValue = function() { return null; }

var PDFFormFieldTextBox = function PDFFormFieldTextBox(x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  this.$input = $('<input type="text"/>').appendTo(this.$element);
};

PDFFormFieldTextBox.prototype = new PDFFormField();
PDFFormFieldTextBox.prototype.constructor = PDFFormFieldTextBox;
PDFFormFieldTextBox.prototype.DESCRIPTIVE_TYPE = 'Text Box';
PDFFormFieldTextBox.prototype.DEFAULT_WIDTH  = 10;
PDFFormFieldTextBox.prototype.DEFAULT_HEIGHT = 2;

PDFFormFieldTextBox.prototype.getPropertiesForm = function() {
  var properties = this._properties;
  var html = '' +
    '<li>' +
      '<label>Name:</label>' +
      '<input type="text" name="attributes.name" value="' + (properties.attributes.name || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Placeholder:</label>' +
      '<input type="text" name="attributes.placeholder" value="' + (properties.attributes.placeholder || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Font Size:</label>' +
      '<input type="number" name="styles.element.font-size" data-value-suffix="px" value="' + window.parseInt(properties.styles.element['font-size'] || '12', 10) + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Tab Order:</label>' +
      '<input type="number" name="attributes.tabindex" value="' + (properties.attributes.tabindex || '0') + '"/>' +
    '</li>';

  return html;
};

var PDFFormFieldTextArea = function PDFFormFieldTextArea(x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  this.$input = $('<textarea/>').appendTo(this.$element);
};

PDFFormFieldTextArea.prototype = new PDFFormField();
PDFFormFieldTextArea.prototype.constructor = PDFFormFieldTextArea;
PDFFormFieldTextArea.prototype.DESCRIPTIVE_TYPE = 'Text Area';
PDFFormFieldTextArea.prototype.DEFAULT_WIDTH  = 16;
PDFFormFieldTextArea.prototype.DEFAULT_HEIGHT = 8;

PDFFormFieldTextArea.prototype.getPropertiesForm = function() {
  var properties = this._properties;
  var html = '' +
    '<li>' +
      '<label>Name:</label>' +
      '<input type="text" name="attributes.name" value="' + (properties.attributes.name || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Placeholder:</label>' +
      '<input type="text" name="attributes.placeholder" value="' + (properties.attributes.placeholder || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Font Size:</label>' +
      '<input type="number" name="styles.element.font-size" data-value-suffix="px" value="' + window.parseInt(properties.styles.element['font-size'] || '12', 10) + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Tab Order:</label>' +
      '<input type="number" name="attributes.tabindex" value="' + (properties.attributes.tabindex || '0') + '"/>' +
    '</li>';

  return html;
};

var PDFFormFieldCheckBox = function PDFFormFieldCheckBox(x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  var $element = this.$element;

  var $label = $('<label class="pdf-form-field-check-box"/>').appendTo($element);
  var $input = this.$input = $('<input type="checkbox"/>').appendTo($label);
  var $icon  = $('<i class="icon-check"/>').appendTo($label);

  var self = this;
  var resizeHandler = function(evt) {
    var size = self._size;
    $icon.css('font-size', Math.min($element.width(), $element.height()) + 'px');
  };

  $element.on(PDFFormField.EventType.Resize, resizeHandler);

  $(document.body).on(PDFViewer.EventType.ScaleChange, function(evt) {
    resizeHandler();
  });

  window.setTimeout(function() { resizeHandler(); }, 1);
};

PDFFormFieldCheckBox.prototype = new PDFFormField();
PDFFormFieldCheckBox.prototype.constructor = PDFFormFieldCheckBox;
PDFFormFieldCheckBox.prototype.DESCRIPTIVE_TYPE = 'Check Box';
PDFFormFieldCheckBox.prototype.DEFAULT_WIDTH  = 2;
PDFFormFieldCheckBox.prototype.DEFAULT_HEIGHT = 2;

PDFFormFieldCheckBox.prototype.getPropertiesForm = function() {
  var properties = this._properties;
  var html = '' +
    '<li>' +
      '<label>Name:</label>' +
      '<input type="text" name="attributes.name" value="' + (properties.attributes.name || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Checked:</label>' +
      '<select name="attributes.checked">' +
        '<option value="false"' + (properties.attributes.checked === false ? ' selected' : '') + '>Unchecked</option>' +
        '<option value="true" ' + (properties.attributes.checked === true  ? ' selected' : '') + '>Checked</option>' +
      '</select>' +
    '</li>' +
    '<li>' +
      '<label>Tab Order:</label>' +
      '<input type="number" name="attributes.tabindex" value="' + (properties.attributes.tabindex || '0') + '"/>' +
    '</li>';

  return html;
};

PDFFormFieldCheckBox.prototype.getValue = function() {
  return this.$input.is(':checked');
};

PDFFormFieldCheckBox.prototype.setValue = function(value) {
  this.$input.prop('checked', !!value);
};
