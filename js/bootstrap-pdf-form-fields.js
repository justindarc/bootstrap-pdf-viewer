'use strict';

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
