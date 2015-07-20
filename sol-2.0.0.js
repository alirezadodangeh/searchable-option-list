/*
 * SOL - Searchable Option List jQuery plugin
 * Version 2.0.0
 * https://pbauerochse.github.io/searchable-option-list/
 *
 * Copyright 2015, Patrick Bauerochse
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 */

/*jslint nomen: true */
;(function ($, window, document) {
    'use strict';

    // constructor
    var SearchableOptionList = function ($element, options) {
        this.$originalElement = $element;
        this.options = options;

        // allow setting options as data attribute
        // e.g. <select data-sol-options="{'allowNullSelection':true}">
        this.metadata = this.$originalElement.data('sol-options');
    };

    // plugin prototype
    SearchableOptionList.prototype = {

        SOL_OPTION_FORMAT : {
            type :     'option',        // fixed
            value :    undefined,       // value that will be submitted
            selected : false,           // boolean selected state
            disabled : false,           // boolean disabled state
            label :    undefined,       // label string
            tooltip:   undefined        // tooltip string
        },
        SOL_OPTIONGROUP_FORMAT : {
            type:     'optiongroup',    // fixed
            label:    undefined,        // label string
            tooltip:  undefined,        // tooltip string
            disabled: false,            // all children disabled boolean property
            children: undefined         // array of SOL_OPTION_FORMAT objects
        },

        DATA_KEY : 'sol-element',
        WINDOW_EVENTS_KEY : 'sol-window-events',

        // default option values
        defaults : {
            data : undefined,

            texts : {
                noItemsAvailable: 'No entries found',
                selectAll: 'Select all',
                selectNone: 'Select none',
                quickDelete: '&times;',
                searchplaceholder: 'Click here to search'
            },

            events: {
                onInitialized: undefined,
                onRendered: undefined,
                onOpen: undefined,
                onClose: undefined,
                onChange: undefined,
                onScroll: function () {
                    var posY = Math.floor(this.$input.offset().top) - Math.floor(this.config.scrollTarget.scrollTop()) + Math.floor(this.$input.outerHeight()),
                        width = Math.ceil((this.$input.outerWidth() + 20) * 1.2);

                    if (this.$originalElement.css('display') === 'block') {
                        width = Math.ceil(this.$input.outerWidth() + this.$caret.outerWidth(false));
                        this.$selectionContainer
                            .css('border-top-left-radius', 0)
                            .css('border-top-right-radius', 0);
                    }

                    this.$selectionContainer
                        .css('top', Math.floor(posY))
                        .css('left', Math.floor(this.$input.offset().left - 1))
                        .css('width', width);
                }
            },

            useBracketParameters: false,
            multiple: undefined,
            showSelectAll: false,
            showSelectionBelowList: false,
            allowNullSelection: false,
            closeOnActionButtons: false,
            scrollTarget: undefined,
            maxDisplayItems: undefined,
            maxHeight: undefined
        },

        // initialize the plugin
        init: function () {

            var originalName = this._getNameAttribute();
            if (!originalName) {
                this._showErrorLabel('name attribute is required');
                return;
            }

            this.config = $.extend(true, {}, this.defaults, this.options, this.metadata);
            this.config.multiple = this.config.multiple || this.$originalElement.attr('multiple');

            if (!this.config.scrollTarget) {
                this.config.scrollTarget = $(window);
            }

            this._registerWindowEventsIfNeccessary();
            this._initializeUiElements();
            this._initializeData();
            this._initializeInputEvents();

            // take original form element out of form submission
            // by removing the name attribute
            this.$originalElement
                .data(this.DATA_KEY, this)
                .removeAttr('name')
                .data('sol-name', originalName);

            return this;
        },

        _getNameAttribute: function () {
            return this.$originalElement.attr('name') || this.$originalElement.data('sol-name');
        },

        // shows an error label
        _showErrorLabel: function (message) {
            var $errorMessage = $('<div style="color: red; font-weight: bold;" />').html(message);
            if (!this.$container) {
                $errorMessage.insertAfter(this.$originalElement);
            } else {
                this.$container.append($errorMessage);
            }
        },

        // register click handler to determine when to trigger the close event
        _registerWindowEventsIfNeccessary: function () {
            if (!window[this.WINDOW_EVENTS_KEY]) {
                $(document).click(function (event) {
                    // if clicked inside a sol element close all others
                    // else close all sol containers
                    var $closestSolContainer = $(event.target).closest('.sol-input-container'),
                        $clickedWithinThisSolContainer = $closestSolContainer.first().parent('.sol-container');

                    $('.sol-container')
                        .not($clickedWithinThisSolContainer)
                        .each(function (index, item) {
                            $(item)
                                .data(SearchableOptionList.prototype.DATA_KEY)
                                .close();
                        });
                });

                // remember we already registered the global events
                window[this.WINDOW_EVENTS_KEY] = true;
            }
        },

        // add sol ui elements
        _initializeUiElements: function () {
            var self = this;

            this.internalScrollWrapper = function () {
                if ($.isFunction(self.config.events.onScroll)) {
                    self.config.events.onScroll.call(self);
                }
            };

            this.$input = $('<input type="text"/>')
                .attr('placeholder', this.config.texts.searchplaceholder);

            this.$noResultsItem = $('<div class="sol-no-results"/>').html(this.config.texts.noItemsAvailable).hide();

            this.$caret = $('<div class="sol-caret-container"><b class="caret"/></div>').click(function () { self.toggle(); });
            var $inputContainer = $('<div class="sol-input-container"/>').append(this.$input).append(this.$caret);

            this.$selection = $('<div class="sol-selection"/>');
            this.$selectionContainer = $('<div class="sol-selection-container"/>').append(this.$noResultsItem).append(this.$selection);
            this.$container = $('<div class="sol-container"/>').data(this.DATA_KEY, this).append($inputContainer).insertBefore(this.$originalElement);

            $inputContainer.append(this.$selectionContainer);

            // add selected items display container
            this.$showSelectionContainer = $('<div class="sol-current-selection"/>');
            if (this.config.showSelectionBelowList) {
                this.$showSelectionContainer.insertAfter($inputContainer);
            } else {
                this.$showSelectionContainer.insertBefore($inputContainer);
            }

            // multiple values selectable
            if (this.config.multiple) {

                // buttons for (de-)select all
                if (this.config.showSelectAll) {
                    var $deselectAllButton = $('<a href="#" class="sol-deselect-all"/>').html(this.config.texts.selectNone).click(function () { self.deselectAll(); }),
                        $selectAllButton = $('<a href="#" class="sol-select-all"/>').html(this.config.texts.selectAll).click(function () { self.selectAll(); });

                    this.$actionButtons = $('<div class="sol-action-buttons"/>').append($selectAllButton).append($deselectAllButton).append('<div class="sol-clearfix"/>');
                    this.$selectionContainer.prepend(this.$actionButtons);
                }
            }

            // dimensions
            if (this.config.maxHeight) {
                this.$selection.css('max-height', this.config.maxHeight);
            }

            var inputWidth = Math.max(this.$input.outerWidth(false), this.$originalElement.outerWidth(false));
            if (this.$originalElement.css('display') === 'block') {
                // block element spanning the whole width -> subtract space for caret and additional spacing
                inputWidth = inputWidth - this.$caret.outerWidth(false) - parseInt($inputContainer.css('border-left-width'), 10) - parseInt($inputContainer.css('border-right-width'), 10);
            }

            this.$input.css('width', inputWidth);

            if ($.isFunction(this.config.events.onRendered)) {
                this.config.events.onRendered.call(this);
            }
        },

        _initializeInputEvents: function () {
            // form event
            var self = this,
                $form = this.$input.parents('form').first();

            if ($form && $form.length === 1 && !$form.data(this.WINDOW_EVENTS_KEY)) {
                var resetFunction = function () {
                    $form.find('.sol-option input').each(function (index, item) {
                        var $item = $(item),
                            initialState = $item.data('sol-item').selected;

                        if ($item.prop('checked') !== initialState) {
                            $item
                                .prop('checked', initialState)
                                .trigger('sol-change');
                        }
                    });
                };

                $form.on('reset', function (event) {
                    // unfortunately the reset event gets fired _before_
                    // the inputs are actually reset. The only possibility
                    // to overcome this is to set an interval to execute
                    // own scripts some time after the actual reset event

                    // before fields are actually reset by the browser
                    // needed to reset newly checked fields
                    resetFunction.call(self);

                    // timeout for selection after form reset
                    // needed to reset previously checked fields
                    setTimeout(function () {
                        resetFunction.call(self);
                    }, 100);
                });

                $form.data(this.WINDOW_EVENTS_KEY, true);
            }

            // text input events
            this.$input
                .focus(function () { self.open(); });

            // navigation
            this.$container
                .on('keydown', function (e) {
                    var keyCode = e.keyCode;

                    // event handling for keyboard navigation
                    // only when there are results to be shown
                    if (!self.$noResultsItem.is(':visible')) {

                        var $currentHighlightedOption,
                            $nextHighlightedOption,
                            directionUp;

                        if (keyCode === 40 || keyCode === 38) {
                            // arrow up or down to select an item
                            self.keyboardNavigationMode = true;
                            self.$selection.addClass('sol-keyboard-navigation');

                            $currentHighlightedOption = self.$selection.find('.sol-option.keyboard-selection');
                            directionUp = keyCode === 38;

                            if (directionUp) {
                                $nextHighlightedOption = $currentHighlightedOption.prevAll('.sol-option:visible').first();
                                if ($nextHighlightedOption.length === 0) {
                                    // we reached the top of the list
                                    $nextHighlightedOption = self.$selection.find('.sol-option:visible:last');
                                }
                            } else {
                                $nextHighlightedOption = $currentHighlightedOption.nextAll('.sol-option:visible').first();
                                // if last is selected jump back to start
                                if ($nextHighlightedOption.length === 0) {
                                    $nextHighlightedOption = self.$selection.find('.sol-option:visible:first');
                                }
                            }

                            $currentHighlightedOption.removeClass('keyboard-selection');
                            $nextHighlightedOption.addClass('keyboard-selection');

                            self.$selection.scrollTop(self.$selection.scrollTop() + $nextHighlightedOption.position().top);
                        } else if (self.keyboardNavigationMode === true && keyCode === 32) {
                            // toggle current selected item with space bar
                            $currentHighlightedOption = self.$selection.find('.sol-option.keyboard-selection input');
                            $currentHighlightedOption
                                .prop('checked', !$currentHighlightedOption.prop('checked'))
                                .trigger('change');

                            // don't add the space character to the input field if it is focused
                            e.preventDefault();
                            return false;
                        }

                    }
                })
                .on('keyup', function (e) {
                    var keyCode = e.keyCode;

                    if (keyCode === 27) {
                        // escape key
                        if (self.keyboardNavigationMode === true) {
                            self.keyboardNavigationMode = false;
                            self.$selection.removeClass('sol-keyboard-navigation');
                            self.$selectionContainer.find('.sol-option.keyboard-selection').removeClass('keyboard-selection');
                            self.$selection.scrollTop(0);
                        } else if (self.$input.val() === '') {
                            // trigger closing of container
                            self.$caret.trigger('click');
                            self.$input.trigger('blur');
                        } else {
                            // reset input
                            self.$input.val('');
                        }
                    } else if (keyCode === 16 || keyCode === 17 || keyCode === 18 || keyCode === 20) {
                        // special events like shift and control
                        return;
                    }

                    self._applySearchTermFilter();
                });
        },

        _applySearchTermFilter: function () {
            if (!this.items || this.items.length === 0) {
                return;
            }

            var searchTerm = this.$input.val(),
                lowerCased = (searchTerm || '').toLowerCase();

            // show previously filtered elements again
            this.$selectionContainer.find('.sol-filtered-search').removeClass('sol-filtered-search');
            this._setNoResultsItemVisible(false);

            if (lowerCased.trim().length > 0) {
                this._findTerms(this.items, lowerCased);
            }
        },

        _findTerms: function (dataArray, searchTerm) {
            if (!dataArray || !$.isArray(dataArray) || dataArray.length === 0) {
                return;
            }

            var self = this;

            $.each(dataArray, function (index, item) {
                if (item.type === 'option') {
                    var $element = item.displayElement,
                        elementSearchableTerms = (item.label + ' ' + item.tooltip).trim().toLowerCase();

                    if (elementSearchableTerms.indexOf(searchTerm) === -1) {
                        $element.addClass('sol-filtered-search');
                    }
                } else {
                    self._findTerms(item.children, searchTerm);
                    var amountOfUnfilteredChildren = item.displayElement.find('.sol-option:not(.sol-filtered-search)');

                    if (amountOfUnfilteredChildren.length === 0) {
                        item.displayElement.addClass('sol-filtered-search');
                    }
                }
            });

            this._setNoResultsItemVisible(this.$selectionContainer.find('.sol-option:not(.sol-filtered-search)').length === 0);
        },

        _initializeData: function () {
            if (!this.config.data) {
                this.items = this._detectDataFromOriginalElement();
            } else if ($.isFunction(this.config.data)) {
                this.items = this._fetchDataFromFunction(this.config.data);
            } else if ($.isArray(this.config.data)) {
                this.items = this._fetchDataFromArray(this.config.data);
            } else if (typeof this.config.data === (typeof 'a string')) {
                this._loadItemsFromUrl(this.config.data);
            } else {
                this._showErrorLabel('Unknown data type');
            }

            if (this.items) {
                // done right away -> invoke postprocessing
                this._processDataItems(this.items);
            }
        },

        _detectDataFromOriginalElement: function () {
            if (this.$originalElement.prop('tagName').toLowerCase() === 'select') {
                var self = this,
                    solData = [];

                $.each(this.$originalElement.children(), function (index, item) {
                    var $item = $(item),
                        itemTagName = $item.prop('tagName').toLowerCase(),
                        solDataItem;

                    if (itemTagName === 'option') {
                        solDataItem = self._processSelectOption($item);
                        if (solDataItem) {
                            solData.push(solDataItem);
                        }
                    } else if (itemTagName === 'optgroup') {
                        solDataItem = self._processSelectOptgroup($item);
                        if (solDataItem) {
                            solData.push(solDataItem);
                        }
                    } else {
                        self._showErrorLabel('Invalid element found in select: ' + itemTagName + '. Only option and optgroup are allowed');
                    }
                });

                return this._invokeConverterIfNeccessary(solData);
            } else if (this.$originalElement.data('sol-data')) {
                var solDataAttributeValue = this.$originalElement.data('sol-data');
                return this._invokeConverterIfNeccessary(solDataAttributeValue);
            } else {
                this._showErrorLabel('Could not determine data from original element. Must be a select or data must be provided as data-sol-data="" attribute');
            }
        },

        _processSelectOption: function ($option) {
            return $.extend({}, this.SOL_OPTION_FORMAT, {
                value:    $option.val(),
                selected: $option.prop('selected'),
                disabled: $option.prop('disabled'),
                label:    $option.html(),
                tooltip:  $option.attr('title'),
                element:  $option
            });
        },

        _processSelectOptgroup: function ($optgroup) {
            var self = this,
                solOptiongroup = $.extend({}, this.SOL_OPTIONGROUP_FORMAT, {
                    label:    $optgroup.attr('label'),
                    tooltip:  $optgroup.attr('title'),
                    disabled: $optgroup.prop('disabled'),
                    children: []
                }),
                optgroupChildren = $optgroup.children('option');

            $.each(optgroupChildren, function (index, item) {
                var $child = $(item),
                    solOption = self._processSelectOption($child);

                // explicitly disable children when optgroup is disabled
                if (solOptiongroup.disabled) {
                    solOption.disabled = true;
                }

                solOptiongroup.children.push(solOption);
            });

            return solOptiongroup;
        },

        _fetchDataFromFunction: function (dataFunction) {
            return this._invokeConverterIfNeccessary(dataFunction(this));
        },

        _fetchDataFromArray: function (dataArray) {
            return this._invokeConverterIfNeccessary(dataArray);
        },

        _loadItemsFromUrl: function (url) {
            var self = this;
            $.ajax(url, {
                success: function (actualData) {
                    self.items = self._invokeConverterIfNeccessary(actualData);
                    if (self.items) {
                        self._processDataItems(self.items);
                    }
                },
                error: function (xhr, status, message) {
                    self._showErrorLabel('Error loading from url ' + url + ': ' + message);
                }
            });
        },

        _invokeConverterIfNeccessary: function (dataItems) {
            if ($.isFunction(this.config.converter)) {
                return this.config.converter.call(this, this, dataItems);
            }
            return dataItems;
        },

        _processDataItems: function (solItems) {
            if (!solItems) {
                this._showErrorLabel('Data items not present. Maybe the converter did not return any values');
                return;
            }

            if (solItems.length === 0) {
                this._setNoResultsItemVisible(true);
                return;
            }

            var self = this;

            $.each(solItems, function (index, item) {
                if (item.type === SearchableOptionList.prototype.SOL_OPTION_FORMAT.type) {
                    self._renderOption(item);
                } else if (item.type === SearchableOptionList.prototype.SOL_OPTIONGROUP_FORMAT.type) {
                    self._renderOptiongroup(item);
                } else {
                    self._showErrorLabel('Invalid item type found ' + item.type);
                    return;
                }
            });
        },

        _renderOption: function (solOption, $optionalTargetContainer) {
            var self = this,
                $actualTargetContainer = $optionalTargetContainer || this.$selection,
                $inputElement,
                $labelText = $('<div class="sol-label-text"/>').html(solOption.label.trim().length === 0 ? '&nbsp;' : solOption.label),
                $label,
                $displayElement,
                inputName = this._getNameAttribute();

            if (this.config.multiple) {
                // use checkboxes
                $inputElement = $('<input type="checkbox" class="sol-checkbox"/>');

                if (this.config.useBracketParameters) {
                    inputName += '[]';
                }
            } else {
                // use radio buttons
                $inputElement = $('<input type="radio" class="sol-radio"/>')
                    .on('change', function () {
                        // when selected notify all others of being deselected
                        self.$selectionContainer.find('input[type="radio"][name="' + inputName + '"]').not($(this)).trigger('sol-deselect');
                    })
                    .on('sol-deselect', function () {
                        // remove display selection item
                        // TODO in this radio button case only one item is visible so maybe just replace the content?
                        // TODO also better show it inline instead of above or below to save space
                        self._removeSelectionDisplayItem($(this));
                    });
            }

            $inputElement
                .on('change', function () {
                    $(this).trigger('sol-change');
                })
                .on('sol-change', function () {
                    self._selectionChange($(this));
                })
                .data('sol-item', solOption)
                .prop('checked', solOption.selected)
                .prop('disabled', solOption.disabled)
                .attr('name', inputName)
                .val(solOption.value);

            $label = $('<label class="sol-label"/>')
                        .attr('title', solOption.tooltip)
                        .append($inputElement)
                        .append($labelText);

            $displayElement = $('<div class="sol-option"/>').append($label);
            solOption.displayElement = $displayElement;

            $actualTargetContainer.append($displayElement);

            if (solOption.selected) {
                this._addSelectionDisplayItem($inputElement);
            }
        },

        _renderOptiongroup: function (solOptiongroup) {
            var self = this,
                $groupCaption = $('<div class="sol-optiongroup-label"/>')
                                    .attr('title', solOptiongroup.tooltip)
                                    .html(solOptiongroup.label),
                $groupItem = $('<div class="sol-optiongroup"/>').append($groupCaption);

            if (solOptiongroup.disabled) {
                $groupItem.addClass('disabled');
            }

            if ($.isArray(solOptiongroup.children)) {
                $.each(solOptiongroup.children, function (index, item) {
                    self._renderOption(item, $groupItem);
                });
            }

            solOptiongroup.displayElement = $groupItem;
            this.$selection.append($groupItem);
        },

        _selectionChange: function ($changeItem) {
            if ($changeItem.prop('checked')) {
                this._addSelectionDisplayItem($changeItem);
            } else {
                this._removeSelectionDisplayItem($changeItem);
            }

            this.config.scrollTarget.trigger('scroll');

            if ($.isFunction(this.config.events.onChange)) {
                this.config.events.onChange.call(this, this, $changeItem);
            }
        },

        _addSelectionDisplayItem: function ($changedItem) {
            var solOptionItem = $changedItem.data('sol-item'),
                $existingDisplayItem = solOptionItem.displaySelectionItem;

            if (!$existingDisplayItem) {
                $existingDisplayItem = $('<div class="sol-selected-display-item"/>')
                    .html(solOptionItem.label)
                    .attr('title', solOptionItem.tooltip)
                    .appendTo(this.$showSelectionContainer);

                // show remove button on display items if not disabled and null selection allowed
                if ((this.config.multiple || this.config.allowNullSelection) && !$changedItem.prop('disabled')) {
                    $('<span class="sol-quick-delete"/>')
                        .html(this.config.texts.quickDelete)
                        .click(function () {
                            $changedItem
                                .prop('checked', false)
                                .trigger('change');
                        })
                        .prependTo($existingDisplayItem);
                }

                solOptionItem.displaySelectionItem = $existingDisplayItem;
            }
        },

        _removeSelectionDisplayItem: function ($changedItem) {
            var solOptionItem = $changedItem.data('sol-item'),
                $myDisplayItem = solOptionItem.displaySelectionItem;

            if ($myDisplayItem) {
                $myDisplayItem.remove();
                solOptionItem.displaySelectionItem = undefined;
            }
        },

        _setNoResultsItemVisible: function (visible) {
            if (visible) {
                this.$noResultsItem.show();

                if (this.$actionButtons) {
                    this.$actionButtons.hide();
                }
            } else {
                this.$noResultsItem.hide();

                if (this.$actionButtons) {
                    this.$actionButtons.show();
                }
            }
        },

        isOpen: function () {
            return this.$container.hasClass('sol-active');
        },

        isClosed: function () {
            return !this.isOpen();
        },

        toggle: function () {
            if (this.isOpen()) {
                this.close();
            } else {
                this.open();
            }
        },

        open: function () {
            if (this.isClosed()) {
                this.$container.addClass('sol-active');
                this.config.scrollTarget.bind('scroll', this.internalScrollWrapper).trigger('scroll');
                $(window).on('resize', this.internalScrollWrapper);

                if ($.isFunction(this.config.events.onOpen)) {
                    this.config.events.onOpen.call(this, this);
                }
            }
        },

        close: function () {
            if (this.isOpen()) {
                this.$container.removeClass('sol-active');
                this.config.scrollTarget.unbind('scroll', this.internalScrollWrapper);
                $(window).off('resize');
                this.$input.val('');

                if ($.isFunction(this.config.events.onClose)) {
                    this.config.events.onClose.call(this, this);
                }
            }
        },

        selectAll: function () {
            if (this.config.showSelectAll && this.config.multiple) {
                var $changedInputs = this.$selectionContainer
                    .find('input[type="checkbox"]:not([disabled], :checked)')
                    .prop('checked', true)
                    .trigger('sol-change');

                if ($.isFunction(this.config.events.onChange)) {
                    this.config.events.onChange.call(this, this, $changedInputs);
                }
            }
        },

        deselectAll: function () {
            if (this.config.showSelectAll && this.config.multiple) {
                var $changedInputs = this.$selectionContainer
                    .find('input[type="checkbox"]:not([disabled]):checked')
                    .prop('checked', false)
                    .trigger('sol-change');

                if ($.isFunction(this.config.events.onChange)) {
                    this.config.events.onChange.call(this, this, $changedInputs);
                }
            }
        },

        getSelection: function () {
            return this.$selection.find('input:checked');
        }
    };

    // jquery plugin boiler plate code
    SearchableOptionList.defaults = SearchableOptionList.prototype.defaults;
    $.fn.searchableOptionList = function (options) {
        var result = [];
        this.each(function () {
            var $this = $(this),
                $alreadyInitializedSol = $this.data(SearchableOptionList.prototype.DATA_KEY);

            if ($alreadyInitializedSol) {
                result.push($alreadyInitializedSol);
            } else {
                result.push(new SearchableOptionList($this, options).init());
            }
        });

        if (result.length === 1) {
            return result[0];
        }

        return result;
    };

}(jQuery, window, document));