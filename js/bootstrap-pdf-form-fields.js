'use strict';

var PDFFormField = function PDFFormField(formLayer, x, y, w, h) {
  if (!(this._formLayer = formLayer)) return;

  var $element = this.$element = $('<div class="pdf-form-field"/>').appendTo(formLayer.$element);
  var element  = this.element  = $element[0];

  this.$input = $('<input type="hidden"/>');

  var self = element.formField = this;

  var generateUniqueId = function() {
    var lastTimestamp = new Date().getTime();
    var newTimestamp = new Date().getTime();

    while (newTimestamp === lastTimestamp) {
      newTimestamp = new Date().getTime();
    }

    return newTimestamp;
  };

  this._id = generateUniqueId();

  formLayer._formFields.push(this);

  var properties = this._properties = {
    attributes: {},
    styles: {}
  };

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

  var position = this._position = { x: x || 100,                y: y || 100 };
  var size     = this._size     = { w: w || this._defaultWidth, h: h || this._defaultHeight };

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

PDFFormField.deserializeField = function(formLayer, serializedField) {
  var formFieldClass = window[serializedField.type] || PDFFormField;
  
  var position = serializedField.position;
  var size     = serializedField.size;

  var formField = new formFieldClass(formLayer, position.x, position.y, size.w, size.h);
  
  formField.setProperties(serializedField.properties);
  formField._id = serializedField.id;

  return formField;
};

PDFFormField.prototype = {
  constructor: PDFFormField,

  _formLayer: null,

  element: null,
  $element: null,

  $input: null,

  _defaultWidth:  100,
  _defaultHeight: 100,

  getClassName: function() {
    var matches = this.constructor.toString().match(/function\s*(\w+)/);
    return matches.length === 2 ? matches[1] : 'PDFFormField';
  },

  serializeField: function() {
    return {
      id:         this._id,
      type:       this.getClassName(),
      position:   this._position,
      size:       this._size,
      properties: this._properties
    };
  },

  serializeValue: function() {
    return {
      id:    this._id,
      value: this.getValue()
    };
  },

  getValue: function() {
    return this.$input.val();
  },

  setValue: function(value) {
    this.$input.val(value || null);
  },

  _id: '',

  getId: function() { return this._id; },

  _descriptiveType: '',

  getDescriptiveType: function() { return this._descriptiveType; },

  _properties: null,

  getProperties: function() { return this._properties; },

  setProperties: function(properties) {
    this._properties = properties || {};
    this.updateInput();
  },

  updateProperties: function() {
    var $panel = this._formLayer._formBuilder.$panel;
    var $form  = $panel.find('form');
    var values = $form.serializeArray();
    var properties = this._properties;
    var i, length, name, value;

    for (i = 0, length = values.length, name, value; i < length; i++) {
      name  = values[i].name;
      value = values[i].value;

      if (name.indexOf('styles.') === 0) {
        value += $form.find('[name="' + name + '"]').attr('data-value-suffix') || '';
        name = name.substr(7);
        properties.styles[name] = value;
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
    var $input = this.$input;
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

    for (name in styles) {
      value = styles[name];

      $input.css(name, value);
    }

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

  _isMoving: false,
  _isResizing: false,

  _activeHandle: null,

  _lastMousePosition: null,
  _lastTouchIdentifier: null,

  _mouseDownHandler: function(evt) {
    var formField = this.formField;
    var isTouchSupported = !!('ontouchstart' in window);
    var $target = $(evt.target);
    var $window = $(window);

    if ($target.hasClass('pdf-form-field-handle')) {
      formField._isResizing = true;
      formField._activeHandle = evt.target.handleType;
    }

    else {
      formField._isMoving = true;
    }

    formField._lastMousePosition = PDFViewer.Util.getPositionForEvent(evt);
    formField._lastTouchIdentifier = isTouchSupported ? evt.originalEvent.targetTouches[0].identifier : null;

    var mouseMoveHandler = function(evt) {
      var isMoving   = formField._isMoving;
      var isResizing = formField._isResizing;
      if (!isMoving && !isResizing) return;

      var mousePosition = PDFViewer.Util.getPositionForEvent(evt, formField._lastTouchIdentifier);
      var mouseDelta    = PDFViewer.Util.getDeltaForPositions(mousePosition, formField._lastMousePosition);

      var scale = formField._formLayer._formBuilder.getScale();
      mouseDelta.x /= scale.x;
      mouseDelta.y /= scale.y;

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

      $window.off(isTouchSupported ? 'touchmove' : 'mousemove', mouseMoveHandler);
      $window.off(isTouchSupported ? 'touchend'  : 'mouseup'  , mouseUpHandler);
    };

    $window.on(isTouchSupported ? 'touchmove' : 'mousemove', mouseMoveHandler);
    $window.on(isTouchSupported ? 'touchend'  : 'mouseup'  , mouseUpHandler);

    evt.preventDefault();
  },

  _position: null, // { x: 0, y: 0 }

  getPosition: function() { return this._position; },

  setPosition: function(x, y) {
    var $element = this.$element;
    var position = this._position;
    position.x = x;
    position.y = y;

    $element.css({
      left: position.x + 'px',
      top:  position.y + 'px'
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
    var size = this._size;
    size.w = w;
    size.h = h;

    $element.css({
      width:  size.w + 'px',
      height: size.h + 'px'
    });

    $element.trigger($.Event(PDFFormField.EventType.Resize, {
      formField: this
    }));
  },

  addToSize: function(deltaW, deltaH) {
    var size = this._size;
    this.setSize(size.w + deltaW, size.h + deltaH);
  },

  _focused: false,

  getFocused: function() { return this._focused; },

  setFocused: function(focused) {
    if (this._focused === focused) return;
    
    var formBuilder = this._formLayer._formBuilder;
    var properties  = this._properties;
    var isTouchSupported = !!('ontouchstart' in window);
    var $element = this.$element;
    if (!$element) return;

    // Check if this form field is losing focus
    if (this._focused && !focused) {
      this.updateProperties();
    }

    if ((this._focused = focused)) {
      if (formBuilder._focusedFormField && formBuilder._focusedFormField !== this) {
        formBuilder._focusedFormField.setFocused(false);
      }
      
      formBuilder.setFocusedFormField(this);
      
      $element.addClass('pdf-form-field-focus');
      $element.on(isTouchSupported ? 'touchstart' : 'mousedown', this._mouseDownHandler);
    
      $element.trigger($.Event(PDFFormField.EventType.Focus, {
        formField: this
      }));
    }

    else {
      formBuilder.setFocusedFormField(null);

      $element.removeClass('pdf-form-field-focus');
      $element.off(isTouchSupported ? 'touchstart' : 'mousedown', this._mouseDownHandler);

      $element.trigger($.Event(PDFFormField.EventType.Blur, {
        formField: this
      }));
    }
  },

  remove: function() {
    var formFields = this._formLayer._formFields;

    for (var i = 0, length = formFields.length; i < length; i++) {
      if (formFields[i] === this) {
        formFields.splice(i, 1);
        break;
      }
    }

    this.$element.remove();

    this.element = this.$element = null;
  }
};

var PDFFormFieldLabel = function PDFFormFieldLabel(formLayer, x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  this.$input = $('<label/>').appendTo(this.$element);
};

PDFFormFieldLabel.prototype = new PDFFormField();
PDFFormFieldLabel.prototype.constructor = PDFFormFieldLabel;
PDFFormFieldLabel.prototype._descriptiveType = 'Label';
PDFFormFieldLabel.prototype._defaultWidth  = 240;
PDFFormFieldLabel.prototype._defaultHeight = 32;

PDFFormFieldLabel.prototype.getPropertiesForm = function() {
  var properties = this._properties;
  var html = '' +
    '<li>' +
      '<label>Text:</label>' +
      '<input type="text" name="html" value="' + (properties.html || '') + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Font Size:</label>' +
      '<input type="number" name="styles.font-size" data-value-suffix="px" value="' + window.parseInt(properties.styles['font-size'] || '16', 10) + '"/>' +
    '</li>';

  return html;
};

PDFFormFieldLabel.prototype.serializeValue = function() { return null; }

var PDFFormFieldTextBox = function PDFFormFieldTextBox(formLayer, x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  this.$input = $('<input type="text"/>').appendTo(this.$element);
};

PDFFormFieldTextBox.prototype = new PDFFormField();
PDFFormFieldTextBox.prototype.constructor = PDFFormFieldTextBox;
PDFFormFieldTextBox.prototype._descriptiveType = 'Text Box';
PDFFormFieldTextBox.prototype._defaultWidth  = 240;
PDFFormFieldTextBox.prototype._defaultHeight = 32;

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
      '<input type="number" name="styles.font-size" data-value-suffix="px" value="' + window.parseInt(properties.styles['font-size'] || '16', 10) + '"/>' +
    '</li>' +
    '<li>' +
      '<label>Tab Order:</label>' +
      '<input type="number" name="attributes.tabindex" value="' + (properties.attributes.tabindex || '0') + '"/>' +
    '</li>';

  return html;
};

var PDFFormFieldCheckBox = function PDFFormFieldCheckBox(formLayer, x, y, w, h) {
  PDFFormField.prototype.constructor.apply(this, arguments);

  var $label = $('<label class="pdf-form-field-check-box"/>').appendTo(this.$element);
  var $input = this.$input = $('<input type="checkbox"/>').appendTo($label);
  var $icon  = $('<i class="icon-check"/>').appendTo($label);

  var self = this;
  var resizeHandler = function(evt) {
    var size = self._size;
    $icon.css('font-size', Math.min(size.w, size.h) + 'px');
  };

  this.$element.on(PDFFormField.EventType.Resize, resizeHandler);

  resizeHandler();
};

PDFFormFieldCheckBox.prototype = new PDFFormField();
PDFFormFieldCheckBox.prototype.constructor = PDFFormFieldCheckBox;
PDFFormFieldCheckBox.prototype._descriptiveType = 'Check Box';
PDFFormFieldCheckBox.prototype._defaultWidth  = 32;
PDFFormFieldCheckBox.prototype._defaultHeight = 32;

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
