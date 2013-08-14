;'use strict';

// Polyfill for window.requestAnimationFrame and window.cancelAnimationFrame.
(function(){var a=0;var b=['webkit','moz','ms','o'];for(var c=0;c<b.length&&!window.requestAnimationFrame;c++){window.requestAnimationFrame=window[b[c]+'RequestAnimationFrame'];window.cancelAnimationFrame=window[b[c]+'CancelAnimationFrame']||window[b[c]+'RequestCancelAnimationFrame'];}if(!window.requestAnimationFrame){window.requestAnimationFrame=function(b,c){var d=Date['now']?Date.now():+(new Date());var e=Math.max(0,16-(d-a));var f=window.setTimeout(function(){b(d+e);},e);a=d+e;return f;};}if(!window.cancelAnimationFrame){window.cancelAnimationFrame=function(a){window.clearTimeout(a);};}})();

// Uncomment to DISABLE WebWorkers support
PDFJS.disableWorker = true;

// Uncomment to ENABLE WebWorkers support
// PDFJS.workerSrc = 'lib/pdf.js';

var PDFViewer = function PDFViewer(element) {
  if (!element) return;
  
  var $element = this.$element = $(element);
  element = this.element = $element[0];
  
  var viewer = element.viewer;
  if (viewer) return viewer;
  
  var self = element.viewer = this;
  
  var $window = $(window);
  var $html   = $(document.documentElement);
  var $body   = $(document.body);
  
  var $navbar = this.$navbar = $('<div class="navbar navbar-static-top"/>').appendTo($element);
  
  var $navbarLeft  = this.$navbarLeft  = $('<ul class="nav navbar-nav pull-left"/>' ).appendTo($navbar);
  var $navbarRight = this.$navbarRight = $('<ul class="nav navbar-nav pull-right"/>').appendTo($navbar);
  
  $('<li class="dropdown">' +
    '<a href="#" class="dropdown-toggle" data-toggle="dropdown"><i class="icon-zoom-in"/> <b class="caret"/></a>' +
    '<ul class="dropdown-menu">' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.AUTO + '"><i class="icon-ok"/> Automatic</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_WIDTH + '"><i/> Page Width</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_HEIGHT + '"><i/> Page Height</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_FIT + '"><i/> Page Fit</a></li>' +
      '<li class="divider"/>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_50  + '"><i/> 50%</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_75  + '"><i/> 75%</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_100 + '"><i/> 100%</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_150 + '"><i/> 150%</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_200 + '"><i/> 200%</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PERCENT_300 + '"><i/> 300%</a></li>' +
    '</ul>' +
  '</li>').appendTo($navbarRight);

  if (!PDFViewer.IS_TOUCH_SUPPORTED) $('<li><a href="#full-screen" rel="tooltip" title="Full Screen"><i class="icon-fullscreen"/></a></li>').appendTo($navbarRight);
  
  if (PDFViewer.IS_TOUCH_SUPPORTED) (function() {
    var $element = null;

    $navbar.delegate('a', 'touchstart', function(evt) {
      $element = $(this);
    });

    $window.on('touchmove', function(evt) {
      if ($element) $element = null;
    });

    $window.on('touchend', function(evt) {
      if (!$element) return;

      evt.preventDefault();

      var $el = $element;
      window.setTimeout(function() { $el.trigger('click'); }, 1);
      
      $element = null;
    });
  })();

  $navbar.find('[rel="tooltip"], [data-rel="tooltip"]').tooltip({
    delay: { show: 300, hide: 150 },
    placement: 'bottom'
  });
  
  $navbar.delegate('a', 'click', function(evt) {
    evt.preventDefault();

    var $button = $(this);
    var href = $button.attr('href');
    
    switch (href) {
      case '#full-screen':
        self.setFullScreen(!self.getFullScreen());
        break;
      case '#zoom':
        if ($button.children('i').hasClass('icon-ok')) return;

        $button.closest('.dropdown-menu').find('i.icon-ok').removeClass('icon-ok');
        $button.children('i').addClass('icon-ok');

        self.setScale($button.attr('data-value'));
        break;
      default:
        break;
    }
  });
  
  var devicePixelRatio = window.devicePixelRatio || 1;
  if (devicePixelRatio !== 1) (function() {
    var inverseRatio = 1 / devicePixelRatio;

    $body.append('<style>' +
      '.pdf-viewer-page-view > canvas {' +
        '-webkit-transform: scale(' + inverseRatio + ');' +
           '-moz-transform: scale(' + inverseRatio + ');' +
            '-ms-transform: scale(' + inverseRatio + ');' +
             '-o-transform: scale(' + inverseRatio + ');' +
                'transform: scale(' + inverseRatio + ');' +
      '}' +
    '</style>');
  })();

  $window.bind('webkitfullscreenchange mozfullscreenchange fullscreenchange', function(evt) {
    var fullScreen = self._fullScreen = document.webkitIsFullScreen || document.mozFullScreen || document.fullScreen;
    if (fullScreen) {
      $html.addClass('pdf-viewer-full-screen');
    }
    
    else {
      $html.removeClass('pdf-viewer-full-screen');
    }
  });

  var resizeTimeout = null;
  $window.bind('resize', function(evt) {
    if (typeof self.getScale() === 'number') return;

    window.clearTimeout(resizeTimeout);

    resizeTimeout = window.setTimeout(function() {
      self.redraw();
    }, PDFViewer.RESIZE_TIMEOUT);
  });
  
  var $viewerContainer   = this.$viewerContainer   = $('<div class="pdf-viewer-container"/>').appendTo($element);
  var $pageViewContainer = this.$pageViewContainer = $('<div class="pdf-viewer-page-view-container pdf-scroll-view"/>').appendTo($viewerContainer);
  
  var scrollView = this._scrollView = new PDFScrollView($pageViewContainer);

  var updateTimeout = null;
  $pageViewContainer.bind('scroll', function(evt) {
    window.clearTimeout(updateTimeout);
    
    updateTimeout = window.setTimeout(function() {
      self.updateView();
    }, PDFViewer.UPDATE_TIMEOUT);
  });
  
  this.optimizeHeight();
  
  var url = $element.attr('data-url');
  if (url) this.setUrl(url);
};

PDFViewer.MINIMUM_HEIGHT     = 400;
PDFViewer.VIEWER_MARGIN      = 10;
PDFViewer.PAGE_SPACING       = 10;
PDFViewer.UPDATE_TIMEOUT     = 100;
PDFViewer.SCROLLBAR_PADDING  = 20;
PDFViewer.RESIZE_TIMEOUT     = 1000;
PDFViewer.IS_TOUCH_SUPPORTED = !!('ontouchstart' in window);

PDFViewer.RenderingStateType = {
  INITIAL:  0,
  RUNNING:  1,
  PAUSED:   2,
  FINISHED: 3
};

PDFViewer.Scale = {
  AUTO:        'pdf-viewer-scale-auto',
  PAGE_WIDTH:  'pdf-viewer-scale-page-width',
  PAGE_HEIGHT: 'pdf-viewer-scale-page-height',
  PAGE_FIT:    'pdf-viewer-scale-page-fit',
  PERCENT_25:  0.25,
  PERCENT_50:  0.5,
  PERCENT_75:  0.75,
  PERCENT_100: 1.0,
  PERCENT_150: 1.5,
  PERCENT_200: 2.0,
  PERCENT_300: 3.0
};

PDFViewer.Util = {
  getVendorPrefix: function() {
    if ('result' in arguments.callee) return arguments.callee.result;

    var regExp = /^(Moz|Webkit|Khtml|O|ms|Icab)(?=[A-Z])/;
    var script = document.createElement('script');

    for (var prop in script.style) {
      if (regExp.test(prop)) return arguments.callee.result = prop.match(regExp)[0].toLowerCase();
    }

    if ('WebkitOpacity' in script.style) return arguments.callee.result = 'webkit';
    if ('KhtmlOpacity' in script.style) return arguments.callee.result = 'khtml';

    return arguments.callee.result = '';
  },

  getPositionForEvent: function(evt, identifier) {
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

  getDeltaForPositions: function(positionA, positionB) {
    return { x: positionA.x - positionB.x, y: positionA.y - positionB.y };
  }
};

PDFViewer.EventType = {
  Ready:       'PDFViewer:Ready',
  ScaleChange: 'PDFViewer:ScaleChange'
};

PDFViewer.prototype = {
  constructor: PDFViewer,
  
  element: null,
  $element: null,
  
  $navbar: null,
  $navbarLeft: null,
  $navbarRight: null,
  $viewerContainer: null,
  $pageViewContainer: null,
  
  _scrollView: null,

  getScrollView: function() { return this._scrollView; },

  _pdfDocument: null,
  
  getPdfDocument: function() { return this._pdfDocument; },
  
  _loading: false,
  
  getLoading: function() { return this._loading; },
  
  _url: null,
  
  getUrl: function() { return this._url; },
  
  setUrl: function(url) {
    var self = this;
    
    this._url = url;
    this._loading = true;
    
    this._scrollView.$content.find('.pdf-viewer-page-view').remove();
    
    PDFJS.getDocument({ url: url }).then(
      function getDocumentCallback(pdfDocument) {
        self._load(pdfDocument);
        self._loading = false;
      },
      function getDocumentError(message, error) {
        self._loading = false;
      },
      function getDocumentProgress(progress) {
        console.log('progress', progress);
      }
    );
  },
  
  _fullScreen: false,
  
  getFullScreen: function() { return this._fullScreen; },
  
  setFullScreen: function(fullScreen) {
    if (fullScreen === this._fullScreen) return;
    
    if (fullScreen) {
      if (document.documentElement.webkitRequestFullScreen) {
        this.element.webkitRequestFullScreen();
      }
      
      else if (document.documentElement.mozRequestFullScreen) {
        this.element.mozRequestFullScreen();
      }
      
      else if (document.documentElement.requestFullScreen) {
        this.element.requestFullScreen();
      }
    }
    
    else {
      if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      }
      
      else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
      
      else if (document.cancelFullScreen) {
        document.cancelFullScreen();
      }
    }
  },

  calculateScale: function(page) {
    var scale = this._scale;

    var pageWidthScale  = 1;
    var pageHeightScale = 1;

    var self = this;

    var calculate = function() {
      var $pageViewContainer = self.$pageViewContainer;
      var containerWidth  = $pageViewContainer.width();
      var containerHeight = $pageViewContainer.height();
      var viewport = page.getViewport(1.0, page.rotate);

      pageWidthScale  = (containerWidth  - PDFViewer.SCROLLBAR_PADDING) / viewport.width  * viewport.scale;
      pageHeightScale = (containerHeight - PDFViewer.SCROLLBAR_PADDING) / viewport.height * viewport.scale;
    };

    switch (scale) {
      case PDFViewer.Scale.AUTO:
        calculate();
        return Math.max(pageWidthScale, pageHeightScale);
        break;
      case PDFViewer.Scale.PAGE_WIDTH:
        calculate();
        return pageWidthScale;
        break;
      case PDFViewer.Scale.PAGE_HEIGHT:
        calculate();
        return pageHeightScale;
        break;
      case PDFViewer.Scale.PAGE_FIT:
        calculate();
        return Math.min(pageWidthScale, pageHeightScale);
        break;
      default:
        break;
    }

    return window.parseFloat(scale);
  },

  _scale: PDFViewer.Scale.AUTO,

  getScale: function() { return this._scale; },

  setScale: function(scale) {
    if (this._scale == scale) return;

    var value = window.parseFloat(scale);
    this._scale = (value == scale) ? value : scale;

    this.redraw();
  },

  _lastCalculatedScale: 0,

  getCalculatedScale: function() {
    return (this._pageViews.length > 0) ? this.calculateScale(this._pageViews[0]) : 1;
  },

  _pageViews: null,
  
  getPageViews: function() { return this._pageViews; },
  
  _currentPageIndex: -1,

  getCurrentPageIndex: function() { return this._currentPageIndex; },

  getCurrentPageView: function() {
    var pageViews = this._pageViews;
    var index = this._currentPageIndex;
    if (index < 0 || !pageViews || pageViews.length === 0) return null;

    return pageViews[index];
  },

  _numberOfPages: 0,

  getNumberOfPages: function() { return this._numberOfPages; },

  _load: function(pdfDocument) {
    var self = this;
    var pageViews = this._pageViews = [];
    this._pdfDocument = pdfDocument;
    
    // TODO: Load document in blocks of 10? 20?
    var numberOfPages = this._numberOfPages = pdfDocument.numPages;
    var pages = [];
    for (var i = 1; i <= numberOfPages; i++) pages.push(pdfDocument.getPage(i));
    // for (var i = 1; i <= 20; i++) pages.push(pdfDocument.getPage(i));
    
    var promise = PDFJS.Promise.all(pages);
    promise.then(function(promisedPages) {
      var actualHeight = 0;
      for (var i = 0, length = promisedPages.length, pageView; i < length; i++) {
        pageViews.push(pageView = new PDFViewerPageView(self, promisedPages[i]));
        actualHeight += pageView.getActualHeight();

        if (i === 0) self._actualWidth = pageView.getActualWidth();
      }
      
      self._actualHeight = actualHeight;

      self.optimizeHeight();
      self.updateView();

      var $element = self.$element;

      $element.trigger($.Event(PDFViewer.EventType.Ready));

      $element.trigger($.Event(PDFViewer.EventType.ScaleChange, {
        scale: self._scale,
        calculatedScale: (self._lastCalculatedScale = self.getCalculatedScale())
      }));
    });
  },
  
  updateView: function() {
    var pageViews  = this._pageViews;
    var scrollTop  = this._scrollView.getPosition().y;
    var viewTop    = scrollTop;
    var viewBottom = scrollTop + this._height - (PDFViewer.PAGE_SPACING * 2);
    
    var minimumViewablePageIndex = -1;
    var maximumViewablePageIndex = -1;
    
    var i, length;
    var pageView, pageViewHeight;

    for (i = 0, length = pageViews.length; i < length; i++) {
      pageView = pageViews[i];
      pageViewHeight = pageView.getHeight() + (PDFViewer.PAGE_SPACING * 2);
      
      if (viewTop >= 0) {
        viewTop -= pageViewHeight;
        
        if (viewTop <= 0) minimumViewablePageIndex = i;
      }
      
      if (viewBottom >= 0) {
        viewBottom -= pageViewHeight;
        
        if (viewBottom <= 0) maximumViewablePageIndex = i;
      }
      
      if (minimumViewablePageIndex > -1 && maximumViewablePageIndex > -1) break;
    }

    if (minimumViewablePageIndex === -1) return;
    if (maximumViewablePageIndex === -1) maximumViewablePageIndex = 0;

    this._currentPageIndex = minimumViewablePageIndex;

    for (i = 0, length = pageViews.length; i < length; i++) {
      pageView = pageViews[i];
      
      if (minimumViewablePageIndex <= i && i <= maximumViewablePageIndex) {
        if (pageView.renderingState === PDFViewer.RenderingStateType.INITIAL) pageView.draw();
      } else {
        if (pageView.renderingState !== PDFViewer.RenderingStateType.INITIAL) pageView.release();
      }
    }
  },
  
  _height: PDFViewer.MINIMUM_HEIGHT,
  
  getHeight: function() { return this._height; },
  
  optimizeHeight: function() {
    var $element = this.$element;

    var windowHeight = $(window).height();
    var viewerOffset = $element.offset().top;
    var viewerMargin = PDFViewer.VIEWER_MARGIN;
    
    var height = windowHeight - viewerOffset - viewerMargin;
    
    if (height !== this._height) {
      this._height = height;
      this.$element.css('height', height + 'px');
    }
  },

  _actualWidth: 0,

  getActualWidth: function() { return this._actualWidth; },

  _actualHeight: 0,

  getActualHeight: function() { return this._actualHeight; },

  redraw: function() {
    this.optimizeHeight();

    var pageViews = this._pageViews;
    for (var i = 0, length = pageViews.length, pageView; i < length; i++) {
      pageView = pageViews[i];

      pageView.release();
      pageView.updateViewportSize();
    }
    
    this.updateView();

    var calculatedScale = this.getCalculatedScale();
    if (calculatedScale !== this._lastCalculatedScale) {
      this.$element.trigger($.Event(PDFViewer.EventType.ScaleChange, {
        scale: this._scale,
        calculatedScale: (this._lastCalculatedScale = calculatedScale)
      }));
    }
  }
};

var PDFViewerPageView = function PDFViewerPageView(viewer, page) {
  if (!(viewer instanceof PDFViewer)) return console.error('Invalid instance of PDFViewer', viewer);

  this._viewer = viewer;
  this._page = page;
  
  this.renderingState = PDFViewer.RenderingStateType.INITIAL;
  
  var pageNumber = page.pageNumber;
  
  var $element = this.$element = $('<div class="pdf-viewer-page-view" id="page-view-' + pageNumber + '"/>');
  var $spinner = this.$spinner = $('<i class="icon-spinner icon-spin"/>').appendTo($element);
  
  this.updateViewportSize();
  this._viewport = null;

  var actualViewport = page.getViewport(1.0, page.rotate);
  this._actualWidth  = Math.round(actualViewport.width);
  this._actualHeight = Math.round(actualViewport.height);

  viewer.getScrollView().$content.append($element);
};

PDFViewerPageView.prototype = {
  constructor: PDFViewerPageView,
  
  $element: null,
  $spinner: null,
  
  canvas: null,
  
  _viewer: null,
  
  getViewer: function() { return this._viewer; },
  
  _page: null,
  
  getPage: function() { return this._page; },
  
  _viewport: null,
  
  getViewport: function() { return this._viewport; },
  
  _width: 0,
  
  getWidth: function() { return this._width; },
  
  _height: 0,
  
  getHeight: function() { return this._height; },
  
  _actualWidth: 0,

  getActualWidth: function() { return this._actualWidth; },

  _actualHeight: 0,

  getActualHeight: function() { return this._actualHeight; },

  _textLayer: null,
  
  getTextLayer: function() { return this._textLayer; },
  
  _textContent: null,

  getTextContent: function() { return this._textContent || (this._textContent = this._page.getTextContent()); },

  renderingState: PDFViewer.RenderingStateType.INITIAL,
  
  draw: function(callback) {
    var self = this;

    if (!this.canvas) this.init();

    this.renderingState = PDFViewer.RenderingStateType.RUNNING;

    var drawCallback = function(error) {
      self.$spinner.hide();
      self.renderingState = PDFViewer.RenderingStateType.FINISHED;
      
      if (error) console.error('An error occurred while rendering the page', error);
      
      if (callback && typeof callback === 'function') callback();
    };
    
    // NOTE: Disable the text layer for performance
    // var textLayer = this._textLayer = new PDFViewerTextLayer(this);
    var textLayer = null;

    this._page.render({
      canvasContext: this.canvas.getContext('2d'),
      viewport: this._viewport,
      textLayer: textLayer,
      continueCallback: function(continueDraw) {
        if (false) {
          self.renderingState = PDFViewer.RenderingStateType.PAUSED;
          
          self.resumeDraw = function() {
            self.renderingState = PDFViewer.RenderingStateType.RUNNING;
            continueDraw();
          };
          
          return;
        }
        
        continueDraw();
      }
    }).then(
      function renderCallback() {
        drawCallback(null);

        if (textLayer) self.getTextContent().then(
          function textContentCallback(textContent) {
            textLayer.setTextContent(textContent);
          }
        );
      },
      function renderError(error) {
        drawCallback(error);
      }
    );
  },

  updateViewportSize: function() {
    var page     = this._page;
    var viewport = this._viewport = page.getViewport(this._viewer.calculateScale(page), page.rotate);
    var width    = this._width    = Math.round(viewport.width);
    var height   = this._height   = Math.round(viewport.height);

    this.$element.css({ width: width + 'px', height: height + 'px' });
  },

  init: function() {
    if (this.canvas) return;

    var devicePixelRatio = window.devicePixelRatio || 1;

    var page     = this._page;
    var viewport = this._viewport = page.getViewport(this._viewer.calculateScale(page), page.rotate);

    var width  = this._width  * devicePixelRatio;
    var height = this._height * devicePixelRatio;

    var canvas = this.canvas = document.createElement('canvas');
    canvas.id     = 'page-' + page.pageNumber;
    canvas.width  = width;
    canvas.height = height;
    
    var ctx = canvas.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);

    var $element = this.$element;

    $element.append(canvas);
    $element.addClass('pdf-viewer-page-view-visible');
    
    this.$spinner.show();

    this.renderingState = PDFViewer.RenderingStateType.INITIAL;
  },

  release: function() {
    if (!this.canvas) return;

    var $element = this.$element;

    $element[0].removeChild(this.canvas);
    $element.removeClass('pdf-viewer-page-view-visible');

    this.canvas = this._viewport = null;

    this._page.destroy();

    this.$spinner.show();

    if (this._textLayer) {
      this._textLayer.$element.remove();
      this._textLayer = null;
    }
    
    this.renderingState = PDFViewer.RenderingStateType.INITIAL;
  }
};

var PDFViewerTextLayer = function PDFViewerTextLayer(pageView) {
  this._pageView = pageView;
  
  var $element = this.$element = $('<div class="pdf-viewer-text-layer"/>');

  pageView.$element.append($element);
};

PDFViewerTextLayer.prototype = {
  constructor: PDFViewerTextLayer,
  
  $element: null,
  
  _pageView: null,
  
  getPageView: function() { return this._pageView; },
  
  _$texts: null,
  _textLayerQueue: null,
  
  beginLayout: function() {
    this._$texts = [];
    this._textLayerQueue = [];
  },
  
  endLayout: function() {
    var self = this;
    
    var $element = this.$element;
    
    var $texts = this._$texts;
    var textLayerQueue = this._textLayerQueue;
    
    var renderInterval = null;
    var isRenderingDone = false;
    
    var $canvas = $('<canvas/>');
    var ctx = $canvas[0].getContext('2d');
    
    var vendorPrefix = PDFViewer.Util.getVendorPrefix();
    
    var render = function() {
      if ($texts.length === 0) {
        window.clearInterval(renderInterval);
        
        isRenderingDone = true;
        $canvas = ctx = null;
        return;
      }
      
      var $text = $texts.shift();
      $element.append($text);
      
      ctx.font = $text.css('font-size') + ' ' + $text.css('font-family');
      
      var width = ctx.measureText($text.text()).width;
      if (width > 0) {
        var textScale = window.parseFloat($text.attr('data-canvas-width')) / width;
        var textStyles = {};
        textStyles['-' + vendorPrefix + '-transform'] = textStyles.transform = 'scale(' + textScale + ', 1)';
        
        $text.css(textStyles);
      }
    };
    
    renderInterval = window.setInterval(render, 0);
    
    var scrollTimeout = null;
    var scrollHandler = function(evt) {
      if (isRenderingDone) {
        $(window).unbind('scroll', scrollHandler);
        return;
      }
      
      window.clearInterval(renderInterval);
      window.clearTimeout(scrollTimeout);
      
      scrollTimeout = window.setTimeout(function() {
        renderInterval = window.setInterval(render, 0);
      }, 500);
    };
    
    $(window).bind('scroll', scrollHandler);
  },
  
  appendText: function(geometry) {
    var fontHeight = geometry.fontSize * Math.abs(geometry.vScale);
    var $text = $('<div style="' +
      'font-size:' + fontHeight + 'px; ' +
      'font-family: ' + geometry.fontFamily + '; ' +
      'top: ' + (geometry.y - fontHeight) + 'px; ' +
      'left: ' + geometry.x + 'px;" ' +
      'data-canvas-width="' + (geometry.canvasWidth * geometry.hScale) + '"/>');
    
    this._$texts.push($text);
  },

  _textContent: null,

  setTextContent: function(textContent) {
    this._textContent = textContent;
    
    var $texts = this._$texts;
    var bidiTexts = textContent.bidiTexts;

    for (var i = 0, length = bidiTexts.length, element, bidiText; i < length; i++) {
      element = $texts[i];
      if (!element) return;
      
      bidiText = bidiTexts[i];
      
      if (!/\S/.test(bidiText.str)) {
        element.dataset.isWhitespace = true;
        continue;
      }

      element.text(bidiText.str);
      element.attr('dir', bidiText.dir === 'rtl' ? 'rtl' : 'ltr');
    }
  }
};

var PDFScrollView = function PDFScrollView(element) {
  var Options = PDFScrollView.Options,
      Util    = PDFViewer.Util;

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

  if (!PDFViewer.IS_TOUCH_SUPPORTED) {
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
        accelerateDelta = Util.getDeltaForPositions(position, startAcceleratePosition),
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

    var touchPosition = Util.getPositionForEvent(evt, lastTouchIdentifier),
        touchDelta    = Util.getDeltaForPositions(touchPosition, lastTouchPosition);
    
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

    $window.off(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchmove' : 'mousemove', touchMoveHandler);
    $window.off(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchend'  : 'mouseup',   touchEndHandler);

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

  $element.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousedown', function(evt) {
    lastTouchPosition = Util.getPositionForEvent(evt);
    lastTouchIdentifier = (PDFViewer.IS_TOUCH_SUPPORTED) ? evt.originalEvent.targetTouches[0].identifier : null;
    
    stopDeceleration();
    resetStartAccelerate(evt.timeStamp);

    self.recalculateDimensions();

    $window.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchmove' : 'mousemove', touchMoveHandler);
    $window.on(PDFViewer.IS_TOUCH_SUPPORTED ? 'touchend'  : 'mouseup',   touchEndHandler);
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
