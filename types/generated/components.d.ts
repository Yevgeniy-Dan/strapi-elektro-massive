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
    link: Attribute.Text;
  };
}

export interface FilterValuesTypevalues extends Schema.Component {
  collectionName: 'components_filter_values_typevalues';
  info: {
    displayName: 'typevalues';
  };
  attributes: {
    product_type: Attribute.Relation<
      'filter-values.typevalues',
      'oneToOne',
      'api::product-type.product-type'
    >;
    values: Attribute.JSON & Attribute.Required;
  };
}

export interface AlternativeTitlesFilterAlternativeTitles
  extends Schema.Component {
  collectionName: 'components_alternative_titles_filter_alternative_titles';
  info: {
    displayName: 'FilterAlternativeTitles';
    description: '';
  };
  attributes: {
    title: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'product-parameter.parameters': ProductParameterParameters;
      'images.images': ImagesImages;
      'filter-values.typevalues': FilterValuesTypevalues;
      'alternative-titles.filter-alternative-titles': AlternativeTitlesFilterAlternativeTitles;
    }
  }
}
