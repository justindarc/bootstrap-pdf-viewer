;'use strict';

// Polyfill for window.requestAnimationFrame and window.cancelAnimationFrame.
(function(){var a=0;var b=['webkit','moz','ms','o'];for(var c=0;c<b.length&&!window.requestAnimationFrame;c++){window.requestAnimationFrame=window[b[c]+'RequestAnimationFrame'];window.cancelAnimationFrame=window[b[c]+'CancelAnimationFrame']||window[b[c]+'RequestCancelAnimationFrame'];}if(!window.requestAnimationFrame){window.requestAnimationFrame=function(b,c){var d=Date['now']?Date.now():+(new Date());var e=Math.max(0,16-(d-a));var f=window.setTimeout(function(){b(d+e);},e);a=d+e;return f;};}if(!window.cancelAnimationFrame){window.cancelAnimationFrame=function(a){window.clearTimeout(a);};}})();

var PDFScrollView = function PDFScrollView(element) {
  var Options = PDFScrollView.Options,
      Util    = PDFScrollView.Util;

  var $element = this.$element = $(element);
  element = this.element = $element[0];
  
  var scrollView = element.scrollView;
  if (scrollView) return scrollView;
  
  var self = element.scrollView = this;

  var $window = $(window);

  var $content = this.$content = $('<div class="pdf-scroll-view-content"/>').append($element.contents()).appendTo($element);
  
  var $horizontalScrollIndicator = this.$horizontalScrollIndicator = $('<div class="pdf-scroll-indicator pdf-scroll-indicator-hidden" style="bottom: 0; left: 0;"/>').appendTo($element),
      $verticalScrollIndicator   = this.$verticalScrollIndicator   = $('<div class="pdf-scroll-indicator pdf-scroll-indicator-hidden" style="top: 0; right: 0;"/>'  ).appendTo($element);

  var size        = this._size        = { w: 0, h: 0 },
      contentSize = this._contentSize = { w: 0, h: 0 },
      margin      = this._margin      = { top: 0, right: 0, bottom: 0, left: 0 },
      position    = this._position    = { x: 0, y: 0 },
      maxPosition = this._maxPosition = { x: 0, y: 0 };

  var isTouchSupported = !!('ontouchstart' in window);

  if (!isTouchSupported) {
    this._useTouchScrolling = false;

    $element.addClass('pdf-scroll-view-no-touch');
    $element.on('scroll', function(evt) {
      position.x = this.scrollLeft;
      position.y = this.scrollTop;
    });

    return this;
  }

  var lastTouchPosition = null,
      lastTouchIdentifier = null,
      startAccelerateTime = null,
      startAcceleratePosition = null,
      isDecelerating = false,
      decelerationAnimationInterval = null;

  var resetStartAccelerate = function(time) {
    startAccelerateTime = time;
    startAcceleratePosition = {
      x: position.x,
      y: position.y
    };
  };

  var startDeceleration = function(startTime) {
    var acceleration = (startAccelerateTime - startTime) / Options.acceleration,
        accelerateDelta = Util.getDeltaForCoordinates(position, startAcceleratePosition),
        velocity = {
          x: accelerateDelta.x / acceleration,
          y: accelerateDelta.y / acceleration
        };
    
    var stepAnimation = function(currentFrameTime) {
      if (!isDecelerating) return;
      
      var animationDelta = {
        x: self.shouldScrollHorizontal() ? velocity.x : 0,
        y: self.shouldScrollVertical()   ? velocity.y : 0
      };
      
      velocity.x *= Options.decelerationFactor;
      velocity.y *= Options.decelerationFactor;
      
      if (Math.abs(velocity.x) <= Options.minVelocity && Math.abs(velocity.y) <= Options.minVelocity) {
        stopDeceleration();
        stopScroll();
        return;
      }
      
      self.setPosition(position.x - velocity.x, position.y - velocity.y);
      
      decelerationAnimationInterval = window.requestAnimationFrame(stepAnimation);
      
      if (self.isPositionInBounds()) return;
      
      var elastic = {
        x: (position.x < 0) ? position.x : (position.x > maxPosition.x) ? position.x - maxPosition.x : 0,
        y: (position.y < 0) ? position.y : (position.y > maxPosition.y) ? position.y - maxPosition.y : 0
      };
      
      if (elastic.x) velocity.x = (elastic.x * velocity.x <= 0) ? velocity.x + (elastic.x * Options.elasticDeceleration) : elastic.x * Options.elasticAcceleration;
      if (elastic.y) velocity.y = (elastic.y * velocity.y <= 0) ? velocity.y + (elastic.y * Options.elasticDeceleration) : elastic.y * Options.elasticAcceleration;
    };
    
    if (Math.abs(velocity.x) > Options.minDecelerationVelocity || Math.abs(velocity.y) > Options.minDecelerationVelocity) {
      isDecelerating = true;
      decelerationAnimationInterval = window.requestAnimationFrame(stepAnimation);
    } else {
      self.bouncePositionInBounds();
      stopScroll();
    }
  };

  var stopDeceleration = function() {
    if (!isDecelerating) return;
    
    isDecelerating = false;
    window.cancelAnimationFrame(decelerationAnimationInterval);
  };

  var startScroll = function() {
    if (self._isScrolling) return;
    self._isScrolling = true;
    
    self.setHorizontalScrollIndicatorHidden(false);
    self.setVerticalScrollIndicatorHidden(false);
  };

  var stopScroll = function() {
    if (!self._isScrolling) return;
    self._isScrolling = false;
    
    var roundedPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y)
    };
    
    self.setHorizontalScrollIndicatorHidden(true);
    self.setVerticalScrollIndicatorHidden(true);
    
    if (position.x !== roundedPosition.x || position.y !== roundedPosition.y) {
      self.setPosition(Math.round(position.x), Math.round(position.y));
    }
  };

  var touchMoveHandler = function(evt) {
    evt.preventDefault();
    
    if (!self._isScrolling) startScroll();

    var touchPosition = Util.getCoordinatesForEvent(evt, lastTouchIdentifier),
        touchDelta    = Util.getDeltaForCoordinates(touchPosition, lastTouchPosition);
    
    if (!self.isPositionInBounds()) {
      touchDelta.x /= 2;
      touchDelta.y /= 2;
    }
    
    self.setPosition(position.x - touchDelta.x, position.y - touchDelta.y);

    var time = evt.timeStamp, accelerationTime = time - startAccelerateTime;
    if (accelerationTime > Options.accelerationTimeout) resetStartAccelerate(time);

    lastTouchPosition = touchPosition;
  };

  var touchEndHandler = function(evt) {
    lastTouchIdentifier = null;

    $window.off(isTouchSupported ? 'touchmove' : 'mousemove', touchMoveHandler);
    $window.off(isTouchSupported ? 'touchend'  : 'mouseup',   touchEndHandler);

    var time = evt.timeStamp, accelerationTime = time - startAccelerateTime;
    if (accelerationTime < Options.accelerationTimeout) {
      startDeceleration(time);
    }
    
    else if (!self.isPositionInBounds()) {
      self.bouncePositionInBounds();
      stopScroll();
    }
    
    else {
      stopScroll();
    }
  };

  $element.on(isTouchSupported ? 'touchstart' : 'mousedown', function(evt) {
    lastTouchPosition = Util.getCoordinatesForEvent(evt);
    lastTouchIdentifier = (isTouchSupported) ? evt.originalEvent.targetTouches[0].identifier : null;
    
    stopDeceleration();
    resetStartAccelerate(evt.timeStamp);

    self.recalculateDimensions();

    $window.on(isTouchSupported ? 'touchmove' : 'mousemove', touchMoveHandler);
    $window.on(isTouchSupported ? 'touchend'  : 'mouseup',   touchEndHandler);
  });
};

PDFScrollView.Options = {
  bounceTransitionDuration: 0.3,
  accelerationTimeout: 250,
  acceleration: 20,
  elasticDeceleration: 0.03,
  elasticAcceleration: 0.18,
  minDecelerationVelocity: 1,
  decelerationFactor: 0.85,
  minVelocity: 0.01,
  minDeltaForScrollEvent: 0.5
};

PDFScrollView.Util = {
  getCoordinatesForEvent: function(evt, identifier) {
    if (evt.type.indexOf('mouse') !== -1) return { x: evt.pageX, y: evt.pageY };
    
    evt = evt.originalEvent;
    
    var touch = (identifier) ? this.getTouchWithIdentifier(evt.touches, identifier) : this.getTouchWithIdentifier(evt.targetTouches);
    return { x: touch.pageX, y: touch.pageY };
  },

  getTouchWithIdentifier: function(touches, identifier) {
    if (touches.length === 0) return null;
    if (!identifier) return touches[0];

    for (var i = 0, length = touches.length, touch; i < length; i++) {
      if ((touch = touches[i]).identifier === identifier) return touch;
    }

    return null;
  },

  getDeltaForCoordinates: function(coordA, coordB) {
    return { x: coordA.x - coordB.x, y: coordA.y - coordB.y };
  }
};

PDFScrollView.prototype = {
  constructor: PDFScrollView,

  element: null,
  $element: null,
  $content: null,

  $horizontalScrollIndicator: null,
  $verticalScrollIndicator: null,

  _alwaysScrollHorizontal: false,
  _alwaysScrollVertical: true,

  _useTouchScrolling: true,
  _isScrolling: false,
  _lastTransitionDuration: '0s',
  _vendorPrefix: (function() {
    var regExp = /^(Moz|Webkit|Khtml|O|ms|Icab)(?=[A-Z])/,
        style = document.createElement('script').style;

    for (var property in style) {
      if (regExp.test(property)) return (property.match(regExp)[0]).toLowerCase();
    }

    if ('WebkitOpacity' in style) return 'webkit';
    if ('KhtmlOpacity'  in style) return 'khtml';

    return '';
  })(),

  _size: null, // { w: 0, h: 0 }
  getSize: function() { return this._size; },

  _contentSize: null, // { w: 0, h: 0 }
  getContentSize: function() { return this._contentSize; },

  _margin: null, // { top: 0, right: 0, bottom: 0, left: 0 }
  getMargin: function() { return this._margin; },
  setMargin: function(top, right, bottom, left) {
    var position = this._position, margin = this._margin;

    margin.top    = (top    !== 0) ? (top    || margin.top   ) : 0;
    margin.right  = (right  !== 0) ? (right  || margin.right ) : 0;
    margin.bottom = (bottom !== 0) ? (bottom || margin.bottom) : 0;
    margin.left   = (left   !== 0) ? (left   || margin.left  ) : 0;
    
    if (this._useTouchScrolling) {
      this.translate(position.x, position.y);
    } else {
      this.$content.css('padding', margin.top + 'px ' + margin.right + 'px ' + margin.bottom + 'px ' + margin.left + 'px');
    }
    
    this.recalculateDimensions();
  },

  _position: null, // { x: 0, y: 0 }
  getPosition: function() { return this._position; },
  setPosition: function(x, y, animationDuration) {
    var $element = this.$element,
        position = this._position,
        minDeltaForScrollEvent = PDFScrollView.Options.minDeltaForScrollEvent,
        shouldTriggerScrollEvent = (Math.abs(position.x - x) > minDeltaForScrollEvent) ||
                                   (Math.abs(position.y - y) > minDeltaForScrollEvent);
    
    x = position.x = this.shouldScrollHorizontal() ? x : 0;
    y = position.y = this.shouldScrollVertical()   ? y : 0;

    if (!this._useTouchScrolling) {
      $element.scrollLeft(x);
      $element.scrollTop(y);
      return;
    }
    
    this.translate(x, y, animationDuration);
    
    if (!shouldTriggerScrollEvent) return;
    
    this.updateHorizontalScrollIndicator();
    this.updateVerticalScrollIndicator();
    
    $element.trigger('scroll');
  },

  _maxPosition: null, // { x: 0, y: 0 }

  _minHorizontalScrollIndicatorLength: 12,
  getMinHorizontalScrollIndicatorLength: function() { return this._minHorizontalScrollIndicatorLength; },
  setMinHorizontalScrollIndicatorLength: function(minHorizontalScrollIndicatorLength) {
    this._minHorizontalScrollIndicatorLength = minHorizontalScrollIndicatorLength;
    this.updateHorizontalScrollIndicator();
  },

  _minVerticalScrollIndicatorLength: 12,
  getMinVerticalScrollIndicatorLength: function() { return this._minVerticalScrollIndicatorLength; },
  setMinVerticalScrollIndicatorLength: function(minVerticalScrollIndicatorLength) {
    this._minVerticalScrollIndicatorLength = minVerticalScrollIndicatorLength;
    this.updateVerticalScrollIndicator();
  },

  _horizontalScrollIndicatorThickness: 7,
  getHorizontalScrollIndicatorThickness: function() { return this._horizontalScrollIndicatorThickness; },
  setHorizontalScrollIndicatorThickness: function(horizontalScrollIndicatorThickness) {
    this._horizontalScrollIndicatorThickness = horizontalScrollIndicatorThickness;
    this.updateHorizontalScrollIndicator();
  },

  _verticalScrollIndicatorThickness: 7,
  getVerticalScrollIndicatorThickness: function() { return this._verticalScrollIndicatorThickness; },
  setVerticalScrollIndicatorThickness: function(verticalScrollIndicatorThickness) {
    this._verticalScrollIndicatorThickness = verticalScrollIndicatorThickness;
    this.updateVerticalScrollIndicator();
  },

  _horizontalScrollIndicatorHidden: true,
  getHorizontalScrollIndicatorHidden: function() { return this._horizontalScrollIndicatorHidden; },
  setHorizontalScrollIndicatorHidden: function(horizontalScrollIndicatorHidden) {
    if ((this._horizontalScrollIndicatorHidden = horizontalScrollIndicatorHidden) || !this.shouldScrollHorizontal()) {
      this.$horizontalScrollIndicator.addClass('pdf-scroll-indicator-hidden');
    } else {
      this.$horizontalScrollIndicator.removeClass('pdf-scroll-indicator-hidden');
    }
  },

  _verticalScrollIndicatorHidden: true,
  getVerticalScrollIndicatorHidden: function() { return this._verticalScrollIndicatorHidden; },
  setVerticalScrollIndicatorHidden: function(verticalScrollIndicatorHidden) {
    if ((this._verticalScrollIndicatorHidden = verticalScrollIndicatorHidden) || !this.shouldScrollVertical()) {
      this.$verticalScrollIndicator.addClass('pdf-scroll-indicator-hidden');
    } else {
      this.$verticalScrollIndicator.removeClass('pdf-scroll-indicator-hidden');
    }
  },

  updateHorizontalScrollIndicator: function() {
    if (this._horizontalScrollIndicatorHidden) return;
    
    var position = this._position.x,
        size = this._size.w,
        contentSize = this._contentSize.w,
        maxPosition = this._maxPosition.x,
        minScrollIndicatorLength = this._minHorizontalScrollIndicatorLength,
        scrollIndicatorThickness = this._horizontalScrollIndicatorThickness,
        scrollIndicatorMargin = this.shouldScrollVertical() ? scrollIndicatorThickness * 2 : scrollIndicatorThickness - 2,
        scrollIndicatorLength = Math.max(minScrollIndicatorLength, (size / contentSize) * (size - scrollIndicatorMargin)),
        scrollIndicatorPosition = (position / maxPosition) * (size - scrollIndicatorMargin - scrollIndicatorLength);
    
    if (position <= 0) {
      scrollIndicatorLength = Math.max(scrollIndicatorThickness - 2, position + scrollIndicatorLength);
      scrollIndicatorPosition = 0;
    }
    
    else if (position >= maxPosition) {
      scrollIndicatorLength = Math.max(scrollIndicatorThickness - 2, (maxPosition - position) + scrollIndicatorLength);
      scrollIndicatorPosition = size - scrollIndicatorLength - scrollIndicatorMargin;
    }
    
    var translation = scrollIndicatorPosition + 'px, 0',
        vendorPrefix = this._vendorPrefix,
        styles = this._horizontalScrollIndicatorStyles = this._horizontalScrollIndicatorStyles || {};

    styles.width = scrollIndicatorLength + 'px';

    styles['-' + vendorPrefix + '-transform'] = styles.transform = 'translate(' + translation + ')';

    this.$horizontalScrollIndicator.css(styles);
  },

  updateVerticalScrollIndicator: function() {
    if (this._verticalScrollIndicatorHidden) return;
    
    var position = this._position.y,
        size = this._size.h,
        contentSize = this._contentSize.h,
        maxPosition = this._maxPosition.y,
        minScrollIndicatorLength = this._minVerticalScrollIndicatorLength,
        scrollIndicatorThickness = this._verticalScrollIndicatorThickness,
        scrollIndicatorMargin = this.shouldScrollHorizontal() ? scrollIndicatorThickness * 2 : scrollIndicatorThickness - 2,
        scrollIndicatorLength = Math.max(minScrollIndicatorLength, (size / contentSize) * (size - scrollIndicatorMargin)),
        scrollIndicatorPosition = (position / maxPosition) * (size - scrollIndicatorMargin - scrollIndicatorLength);
    
    if (position <= 0) {
      scrollIndicatorLength = Math.max(scrollIndicatorThickness - 2, position + scrollIndicatorLength);
      scrollIndicatorPosition = 0;
    }
    
    else if (position >= maxPosition) {
      scrollIndicatorLength = Math.max(scrollIndicatorThickness - 2, (maxPosition - position) + scrollIndicatorLength);
      scrollIndicatorPosition = size - scrollIndicatorLength - scrollIndicatorMargin;
    }
    
    var translation = '0, ' + scrollIndicatorPosition + 'px',
        vendorPrefix = this._vendorPrefix,
        styles = this._verticalScrollIndicatorStyles = this._verticalScrollIndicatorStyles || {};

    styles.height = scrollIndicatorLength + 'px';

    styles['-' + vendorPrefix + '-transform'] = styles.transform = 'translate(' + translation + ')';

    this.$verticalScrollIndicator.css(styles);
  },

  shouldScrollHorizontal: function() {
    return this._alwaysScrollHorizontal || this._contentSize.w > this._size.w;
  },

  shouldScrollVertical: function() {
    return this._alwaysScrollVertical || this._contentSize.h > this._size.h;
  },

  recalculateDimensions: function() {
    var $element = this.$element,
        $content = this.$content,
        size = this._size,
        contentSize = this._contentSize,
        margin = this._margin,
        maxPosition = this._maxPosition;
    
    size.w = $element.width();
    size.h = $element.height();
    
    contentSize.w = Math.max($content.width(),  size.w) + margin.left + margin.right;
    contentSize.h = Math.max($content.height(), size.h) + margin.top  + margin.bottom;
    
    maxPosition.x = contentSize.w - size.w;
    maxPosition.y = contentSize.h - size.h;
    
    $element.trigger('scroll');
  },

  isPositionInBounds: function() {
    var position    = this._position,
        maxPosition = this._maxPosition,
        clampedX    = Math.min(Math.max(0, position.x), maxPosition.x),
        clampedY    = Math.min(Math.max(0, position.y), maxPosition.y);
    
    return (position.x === clampedX && position.y === clampedY);
  },

  bouncePositionInBounds: function() {
    var position    = this._position,
        maxPosition = this._maxPosition,
        clampedX    = Math.min(Math.max(0, position.x), maxPosition.x),
        clampedY    = Math.min(Math.max(0, position.y), maxPosition.y);
    
    this.setPosition(clampedX, clampedY, PDFScrollView.Options.bounceTransitionDuration);
  },

  translate: function(x, y, animationDuration) {
    var margin = this._margin,
        translation = (margin.left - x) + 'px, ' + (margin.top - y) + 'px',
        duration = (animationDuration || '0') + 's',
        vendorPrefix = this._vendorPrefix,
        styles = this._contentStyles = this._contentStyles || {};

    if (duration !== this._lastTransitionDuration) this._lastTransitionDuration = styles['-' + vendorPrefix + '-transition-duration'] = styles['transition-duration'] = duration;
    styles['-' + vendorPrefix + '-transform'] = styles.transform = 'translate(' + translation + ')';

    this.$content.css(styles);
  }
};
