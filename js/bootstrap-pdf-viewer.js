// Uncomment to DISABLE WebWorkers support
// PDFJS.disableWorker = true;

// Uncomment to ENABLE WebWorkers support
PDFJS.workerSrc = 'js/vendor/pdf.js';

var PDFViewer = function PDFViewer(element) {
  if (!element) return;
  
  var $element = this.$element = $(element);
  element = this.element = $element[0];
  
  var pdfViewer = element.pdfViewer;
  if (pdfViewer) return pdfViewer;
  
  var self = element.pdfViewer = this;
  
  var $window = $(window);
  var $html   = $(document.documentElement);
  var $body   = $(document.body);
  
  var $navbarContainer = this.$navbarContainer = $('<div class="navbar"/>').appendTo($element);
  var $navbarInner = $('<div class="navbar-inner"/>').appendTo($navbarContainer);
  
  var $navbarLeft  = this.$navbarLeft  = $('<ul class="nav pull-left"/>' ).appendTo($navbarInner);
  var $navbarRight = this.$navbarRight = $('<ul class="nav pull-right"/>').appendTo($navbarInner);
  
  $('<li class="dropdown">' +
    '<a href="#" class="dropdown-toggle" data-toggle="dropdown"><i class="icon-zoom-in"/> Zoom <b class="caret"/></a>' +
    '<ul class="dropdown-menu">' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.AUTO + '"><i class="icon-ok"/> Automatic</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.ACTUAL + '"><i/> Actual Size</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_WIDTH + '"><i/> Page Width</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_HEIGHT + '"><i/> Page Height</a></li>' +
      '<li><a href="#zoom" data-value="' + PDFViewer.Scale.PAGE_FIT + '"><i/> Page Fit</a></li>' +
    '</ul>' +
  '</li>').appendTo($navbarLeft);

  $('<li><a href="#full-screen" rel="tooltip" title="Full Screen"><i class="icon-fullscreen"/> Full Screen</a></li>').appendTo($navbarRight);
  
  $navbarInner.find('[rel="tooltip"], [data-rel="tooltip"]').tooltip({
    delay: { show: 300, hide: 150 },
    placement: 'bottom'
  });
  
  $navbarInner.delegate('a', 'click', function(evt) {
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
    if (self.getScale() === PDFViewer.Scale.ACTUAL) return;

    window.clearTimeout(resizeTimeout);

    resizeTimeout = window.setTimeout(function() {
      self.redraw();
    }, PDFViewer.RESIZE_TIMEOUT);
  });
  
  var $pageViewContainer = this.$pageViewContainer = $('<div class="pdf-viewer-page-view-container pdf-scroll-view"/>').appendTo($element);
  
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

PDFViewer.MINIMUM_HEIGHT    = 400;
PDFViewer.PAGE_SPACING      = 10;
PDFViewer.UPDATE_TIMEOUT    = 500;
PDFViewer.SCROLLBAR_PADDING = 40;
PDFViewer.RESIZE_TIMEOUT    = 1000;

PDFViewer.RenderingStateType = {
  INITIAL:  0,
  RUNNING:  1,
  PAUSED:   2,
  FINISHED: 3
};

PDFViewer.Scale = {
  AUTO:        'pdf-viewer-scale-auto',
  ACTUAL:      'pdf-viewer-scale-actual',
  PAGE_WIDTH:  'pdf-viewer-scale-page-width',
  PAGE_HEIGHT: 'pdf-viewer-scale-page-height',
  PAGE_FIT:    'pdf-viewer-scale-page-fit'
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
  }
};

PDFViewer.prototype = {
  constructor: PDFViewer,
  
  element: null,
  $element: null,
  
  $navbarContainer: null,
  $navbarLeft: null,
  $navbarRight: null,
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
    
    this._scrollView.$content.empty();
    
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
      case PDFViewer.Scale.ACTUAL:
        return 1.0;
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
    if (this._scale === scale) return;

    this._scale = scale;
    this.redraw();
  },

  _pageViews: null,
  
  getPageViews: function() { return this._pageViews; },
  
  getCurrentPageView: function() {
    var pageViews = this._pageViews;
    if (!pageViews || pageViews.length === 0) return null;

    return pageViews[0];
  },

  _load: function(pdfDocument) {
    var self = this;
    var pageViews = this._pageViews = [];
    this._pdfDocument = pdfDocument;
    
    var numberOfPages = pdfDocument.numPages, pages = [];
    for (var i = 1; i <= numberOfPages; i++) pages.push(pdfDocument.getPage(i));
    
    var promise = PDFJS.Promise.all(pages);
    promise.then(function(promisedPages) {
      for (var i = 0, length = promisedPages.length; i < length; i++) {
        pageViews.push(new PDFViewerPageView(self, promisedPages[i]));
      }
      
      self.optimizeHeight();
      self.updateView();
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
      pageViewHeight = pageView.getHeight() + PDFViewer.PAGE_SPACING;
      
      if (viewTop >= 0) {
        viewTop -= pageViewHeight;
        
        if (viewTop < 0) minimumViewablePageIndex = i;
      }
      
      if (viewBottom >= 0) {
        viewBottom -= pageViewHeight;
        
        if (viewBottom < 0) maximumViewablePageIndex = i;
      }
      
      if (minimumViewablePageIndex > -1 && maximumViewablePageIndex > -1) break;
    }
    
    if (minimumViewablePageIndex === -1 || maximumViewablePageIndex === -1) return;

    for (i = 0, length = pageViews.length; i < length; i++) {
      pageView = pageViews[i];
      
      if (minimumViewablePageIndex <= i && i <= maximumViewablePageIndex) {
        if (pageView.getRenderingState() === PDFViewer.RenderingStateType.INITIAL) pageView.draw();
      } else {
        if (pageView.getRenderingState() !== PDFViewer.RenderingStateType.INITIAL) pageView.release();
      }
    }
  },
  
  _height: PDFViewer.MINIMUM_HEIGHT,
  
  getHeight: function() { return this._height; },
  
  optimizeHeight: function() {
    var $element = this.$element;

    var windowHeight = $(window).height();
    var viewerOffset = $element.offset().top;
    var viewerMargin = window.parseInt($element.css('margin-bottom'), 10) + 2;
    
    var height = windowHeight - viewerOffset - viewerMargin;
    
    if (height !== this._height) {
      this._height = height;
      this.$element.css('height', height + 'px');
    }
  },

  redraw: function() {
    this.optimizeHeight();

    var pageViews = this._pageViews;
    for (var i = 0, length = pageViews.length, pageView; i < length; i++) {
      pageView = pageViews[i];

      pageView.release();
      pageView.updateViewportSize();
    }
    
    this.updateView();
  }
};

var PDFViewerPageView = function PDFViewerPageView(pdfViewer, page) {
  this._pdfViewer = pdfViewer;
  this._page = page;
  
  this._renderingState = PDFViewer.RenderingStateType.INITIAL;
  
  var viewport = this._viewport = page.getViewport(pdfViewer.calculateScale(page), page.rotate);
  var width    = this._width    = viewport.width;
  var height   = this._height   = viewport.height;
  
  var pageNumber = page.pageNumber;
  
  var $element = this.$element = $('<div class="pdf-viewer-page-view" id="page-view-' + pageNumber + '" style="width: ' + width + 'px; height: ' + height + 'px;"/>');
  var $anchor  = this.$anchor  = $('<a name="page-' + pageNumber + '"/>').appendTo($element);
  var $spinner = this.$spinner = $('<i class="icon-spinner icon-spin"/>').appendTo($element);
  
  pdfViewer.getScrollView().$content.append($element);
};

PDFViewerPageView.prototype = {
  constructor: PDFViewerPageView,
  
  $element: null,
  $anchor: null,
  $canvas: null,
  $spinner: null,
  
  ctx: null,
  
  _pdfViewer: null,
  
  getPdfViewer: function() { return this._pdfViewer; },
  
  _page: null,
  
  getPage: function() { return this._page; },
  
  _viewport: null,
  
  getViewport: function() { return this._viewport; },
  
  _width: 0,
  
  getWidth: function() { return this._width; },
  
  _height: 0,
  
  getHeight: function() { return this._height; },
  
  _textLayer: null,
  
  getTextLayer: function() { return this._textLayer; },
  
  _textContent: null,

  getTextContent: function() { return this._textContent || (this._textContent = this._page.getTextContent()); },

  _renderingState: PDFViewer.RenderingStateType.INITIAL,
  
  getRenderingState: function() { return this._renderingState; },
  
  draw: function(callback) {
    var self = this;
    
    this._renderingState = PDFViewer.RenderingStateType.RUNNING;
    
    if (!this.$canvas) this.init();

    var drawCallback = function(error) {
      self.$spinner.hide();
      self._renderingState = PDFViewer.RenderingStateType.FINISHED;
      
      if (error) console.error('An error occurred while rendering the page', error);
      
      if (callback && typeof callback === 'function') callback();
    };
    
    // NOTE: Disable the text layer for performance
    // var textLayer = this._textLayer = new PDFViewerTextLayer(this);
    var textLayer = null;

    this._page.render({
      canvasContext: this.ctx,
      viewport: this._viewport,
      textLayer: textLayer,
      continueCallback: function(continueDraw) {
        if (false) {
          self._renderingState = PDFViewer.RenderingStateType.PAUSED;
          
          self.resumeDraw = function() {
            self._renderingState = PDFViewer.RenderingStateType.RUNNING;
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
    var viewport = this._viewport = page.getViewport(this._pdfViewer.calculateScale(page), page.rotate);
    var width    = this._width    = viewport.width;
    var height   = this._height   = viewport.height;

    this.$element.css({ width: width + 'px', height: height + 'px' });
  },

  init: function() {
    if (this.$canvas) return;

    var width  = this._width;
    var height = this._height;

    var $canvas = this.$canvas = $('<canvas id="page-' + this._page.pageNumber + '" width="' + width + '" height="' + height + '"/>').appendTo(this.$element);
    var ctx = this.ctx = $canvas[0].getContext('2d');

    ctx.save();
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    this.$spinner.show();

    this._renderingState = PDFViewer.RenderingStateType.INITIAL;
  },

  release: function() {
    if (!this.$canvas) return;

    this.$canvas.remove();

    this.$canvas = null;
    this.ctx = null;

    this.$spinner.show();

    if (this._textLayer) {
      this._textLayer.$element.remove();
      this._textLayer = null;
    }
    
    this._renderingState = PDFViewer.RenderingStateType.INITIAL;
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

$(function() {
  $('.pdf-viewer').each(function(index, element) { new PDFViewer(element); });
});
