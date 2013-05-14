;'use strict';

var PDFFormBuilder = function PDFFormBuilder(pdfViewer) {
  if (!(pdfViewer instanceof PDFViewer)) return console.error("Invalid instance of PDFViewer", pdfViewer);

  this._pdfViewer = pdfViewer;

  var self = pdfViewer._formBuilder = this;

  pdfViewer.getFormBuilder = function() { return this._formBuilder; };

  var formLayer = this._formLayer = new PDFFormLayer(this);

  var $navbarContainer = pdfViewer.$navbarContainer;
  var $navbarLeft = pdfViewer.$navbarLeft;

  $('<li class="divider"/>').appendTo($navbarLeft);

  $('<li><a href="#text-field" rel="tooltip" title="Text Field"><i class="icon-edit"/></a></li>').appendTo($navbarLeft);
  $('<li><a href="#checkbox" rel="tooltip" title="Checkbox"><i class="icon-check"/></a></li>').appendTo($navbarLeft);
  
  $navbarContainer.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    var position = pdfViewer.getScrollView().getPosition();

    console.log(pdfViewer.getCurrentPageView());

    switch (href) {
      case '#text-field':
        (function() {
          var field = new PDFFormField(formLayer, position.x + 50, position.y + 50, 100, 40);
        })();
        break;
      case '#checkbox':
        (function() {
          var field = new PDFFormField(formLayer, position.x + 50, position.y + 50, 40, 40);
        })();
        break;
      default:
        break;
    }
  });

  var isTouchSupported = !!('ontouchstart' in window);
  pdfViewer.$element.on(isTouchSupported ? 'touchstart' : 'mousedown', function(evt) {
    pdfViewer.$element.find('.pdf-form-field-focus').each(function(index, element) {
      var formField = element.formField;
      if (!formField) return;

      formField.setFocused(false);
    });
  });

  pdfViewer.$element.delegate('.pdf-form-field', isTouchSupported ? 'touchstart' : 'mousedown', function(evt) {
    var formField = this.formField;
    if (!formField) return;

    formField.setFocused(true);
    formField._mouseDownHandler.call(formField.element, evt);

    evt.stopImmediatePropagation();
  });
};

PDFFormBuilder.prototype = {
  constructor: PDFFormBuilder,

  _pdfViewer: null,
  _formLayer: null,

  _focusedFormField: null
};

var PDFFormLayer = function PDFFormLayer(formBuilder) {
  if (!(formBuilder instanceof PDFFormBuilder)) return console.error("Invalid instance of PDFFormBuilder", formBuilder);

  this._formBuilder = formBuilder;

  var $element = this.$element = $('<div class="pdf-form-layer"/>').appendTo(formBuilder._pdfViewer.getScrollView().$content);
  var element  = this.element  = $element[0];

  var self = element.formLayer = this;

  var formFields = this._formFields = [];
};

PDFFormLayer.prototype = {
  constructor: PDFFormLayer,

  _pdfViewer: null,

  element: null,
  $element: null,

  _formFields: null,

  getFormFields: function() { return this._formFields; }
};

var PDFFormField = function PDFFormField(formLayer, x, y, w, h) {
  if (!(formLayer instanceof PDFFormLayer)) return console.error("Invalid instance of PDFFormLayer", formLayer);

  this._formLayer = formLayer;

  var $element = this.$element = $('<div class="pdf-form-field"/>').appendTo(formLayer.$element);
  var element  = this.element  = $element[0];

  var self = element.formField = this;

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

  var position = this._position = { x: x || 100, y: y || 100 };
  var size     = this._size     = { w: w || 100, h: h || 100 };

  this.setPosition(position.x, position.y);
  this.setSize(size.w, size.h);
};

PDFFormField.EventType = {
  Focus: 'PDFFormField:Focus',
  Blur:  'PDFFormField:Blur'
};

PDFFormField.HandleType = { N: 'n', NE: 'ne', E: 'e', SE: 'se', S: 's', SW: 'sw', W: 'w', NW: 'nw' };

PDFFormField.prototype = {
  constructor: PDFFormField,

  _formLayer: null,

  element: null,
  $element: null,

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
    var position = this._position;
    position.x = x;
    position.y = y;

    this.$element.css({
      left: position.x + 'px',
      top:  position.y + 'px'
    });
  },

  addToPosition: function(deltaX, deltaY) {
    var position = this._position;
    this.setPosition(position.x + deltaX, position.y + deltaY);
  },

  _size: null, // { w: 0, h: 0 }

  getSize: function() { return this._size; },

  setSize: function(w, h) {
    var size = this._size;
    size.w = w;
    size.h = h;

    this.$element.css({
      width:  size.w + 'px',
      height: size.h + 'px'
    });
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
    var isTouchSupported = !!('ontouchstart' in window);
    var $element = this.$element;

    if ((this._focused = focused)) {
      if (formBuilder._focusedFormField && formBuilder._focusedFormField !== this) formBuilder._focusedFormField.setFocused(false);
      formBuilder._focusedFormField = this;
      
      $element.addClass('pdf-form-field-focus');
      $element.on(isTouchSupported ? 'touchstart' : 'mousedown', this._mouseDownHandler);
    
      $element.trigger($.Event(PDFFormField.EventType.Focus, {
        formField: this
      }));
    }

    else {
      $element.removeClass('pdf-form-field-focus');
      $element.off(isTouchSupported ? 'touchstart' : 'mousedown', this._mouseDownHandler);

      $element.trigger($.Event(PDFFormField.EventType.Blur, {
        formField: this
      }));
    }
  }
};
