import type { Schema, Attribute } from '@strapi/strapi';

export interface ProductParameterParameters extends Schema.Component {
  collectionName: 'components_product_parameter_parameters';
  info: {
    displayName: 'parameters';
    description: '';
  };
  attributes: {
    key: Attribute.String & Attribute.Required;
    value: Attribute.String & Attribute.Required;
  };
}

export interface ImagesImages extends Schema.Component {
  collectionName: 'components_images_images';
  info: {
    displayName: 'Images';
    description: '';
  };
  attributes: {
    link: Attribute.String;
  };
}

export interface FilterValueFilterValues extends Schema.Component {
  collectionName: 'components_filter_value_filter_values';
  info: {
    displayName: 'FilterValues';
    description: '';
  };
  attributes: {
    value: Attribute.String & Attribute.Required;
  };
}

export interface AlternativeTitlesFilterAlternativeTitles
  extends Schema.Component {
  collectionName: 'components_alternative_titles_filter_alternative_titles';
  info: {
    displayName: 'FilterAlternativeTitles';
  };
  attributes: {
    title: Attribute.String & Attribute.Unique;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'product-parameter.parameters': ProductParameterParameters;
      'images.images': ImagesImages;
      'filter-value.filter-values': FilterValueFilterValues;
      'alternative-titles.filter-alternative-titles': AlternativeTitlesFilterAlternativeTitles;
    }
  }
}
