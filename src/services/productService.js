const { extendType, arg } = require("nexus");

const { idArg, nonNull, list, stringArg, intArg, floatArg } = require("nexus");

const getProductTypeFilters = extendType({
  type: "Query",
  definition(t) {
    t.field("productTypeFilters", {
      type: "JSON",
      args: {
        productTypeId: idArg(),
        subcategoryId: nonNull(idArg()),
        locale: nonNull("I18NLocaleCode"),
      },
      resolve: async (_, { productTypeId, subcategoryId, locale }, ctx) => {
        try {
          // Check API token permissions
          await strapi.auth.verify(ctx.state.auth, {
            scope: ["api::product.product.find"],
          });

          const knex = strapi.db.connection;

          let query = knex("products")
            .join(
              "product_types_products_links",
              "products.id",
              "product_types_products_links.product_id"
            )
            .join(
              "product_types_subcategories_links",
              "product_types_products_links.product_type_id",
              "product_types_subcategories_links.product_type_id"
            )
            .where({
              "product_types_subcategories_links.subcategory_id": subcategoryId,
              "products.locale": locale,
            });

          if (productTypeId) {
            query = query.where(
              "product_types_products_links.product_type_id",
              productTypeId
            );
          }

          const results = await query
            .select("products.params")
            .whereNotNull("products.params");

          const filterKeyMappings = {
            uk: {
              "Світловий потік": "Світловий потік Lm",
              "Світловий потік Lm": "Світловий потік Lm",
            },
            ru: {
              "Световой поток": "Световой поток Lm",
              "Световой поток Lm": "Световой поток Lm",
            },
          };

          const allowedFilterKeys = {
            uk: [
              "Wi-Fi", "Ємність акумулятора", "Індикація", "Акумулятор", "Бренд", "Вага", "Вбудований розмір",
              "Версія HDMI", "Версія USB", "Верхній поріг вхідної напруги В", "Вид люстри", "Вихідна напруга АКБ",
              "Вихідна потужність", "Вихідні інтерфейси", "Внутрішній діаметр", "Вхідні інтерфейси", "Відстань виявлення",
              "Гарантія міс.", "Дальність", "Датчик руху", "Джерело живлення", "Довжина", "Діаметр після усадки, мм",
              "Діапазон роботи MPPT контролера", "Елементи живлення", "Енергоефективність", "Енергія батареї", "Живлення",
              "Зарядний струм (макс.)", "Захист вологи", "Зовнішній діаметр", "Клас захисту IP", "Коефіцієнт усадки",
              "Колір корпусу", "Колір свічення", "Колірна температура світла", "Конструкція реле напруги", "Країна-виробник",
              "Кут виявлення", "Кут розсіювання", "Кількість MPPT трекерів", "Кількість каналів", "Кількість модулів",
              "Кількість патронів", "Кількість полюсів", "Кількість роз’ємів", "Кількість тарифів", "Кількість фаз",
              "Максимальна потужність", "Максимальна потужність реле Вт", "Максимальна сила струму", "Максимальний струм",
              "Матеріал", "Матеріал виробу", "Матеріал жили", "Матеріал корпусу", "Матеріал ізоляції", "Модель батареї",
              "Місткість батареї", "Місце під лічильник", "Направленість світла", "Напруга системи", "Наявність заземлення",
              "Наявність замка", "Наявність шторок", "Нижній поріг вхідної напруги В", "Номінал трансформатора",
              "Номінальна напруга", "Номінальна потужність", "Номінальний струм", "Особливості", "Отвір під дріт, мм²",
              "Паралельне підключення", "Переріз жили кв.мм", "Потужність сонячної панелі", "Підсвітка",
              "Підтримка мобільного застосунку", "Розмір", "Світловий потік", "Спосіб монтажу", "Стартова напруга поля PV",
              "Ступінь захисту", "Тип акумулятора", "Тип батареї", "Тип вилки", "Тип вимикача", "Тип дверцят",
              "Тип живлення", "Тип лампи", "Тип лічильника", "Тип модуля", "Тип монтажу", "Тип підключення",
              "Тип світильника", "Тип стабілізатора", "Тип товару", "Тип трансформатора", "Тип цоколя", "Тип індикації",
              "Форма", "Форма люстри", "Цикл життя", "Циклічний ресурс", "Час заряду", "Ширина"
            ],
            ru: [
              "Wi-Fi", "Емкость аккумулятора", "Индикация", "Аккумулятор", "Бренд", "Вес", "Встроенный размер",
              "Версия HDMI", "Версия USB", "Верхний порог входного напряжения В", "Вид люстры", "Выходное напряжение АКБ",
              "Выходная мощность", "Выходные интерфейсы", "Внутренний диаметр", "Входные интерфейсы", "Дальность обнаружения",
              "Гарантия мес.", "Дальность", "Датчик движения", "Источник питания", "Длина", "Диаметр после усадки, мм",
              "Диапазон работы MPPT контроллера", "Элементы питания", "Энергоэффективность", "Энергия батареи", "Питание",
              "Зарядный ток (макс.)", "Защита от влаги", "Внешний диаметр", "Класс защиты IP", "Коэффициент усадки",
              "Цвет корпуса", "Цвет свечения", "Цветовая температура света", "Конструкция реле напряжения", "Страна-производитель",
              "Угол обнаружения", "Угол рассеивания", "Количество MPPT трекеров", "Количество каналов", "Количество модулей",
              "Количество патронов", "Количество полюсов", "Количество разъемов", "Количество тарифов", "Количество фаз",
              "Максимальная мощность", "Максимальная мощность реле Вт", "Максимальная сила тока", "Максимальный ток",
              "Материал", "Материал изделия", "Материал жил", "Материал корпуса", "Материал изоляции", "Модель батареи",
              "Вместимость батареи", "Место под счетчик", "Направленность света", "Напряжение системы", "Наличие заземления",
              "Наличие замка", "Наличие шторок", "Нижний порог входного напряжения В", "Номинал трансформатора",
              "Номинальное напряжение", "Номинальная мощность", "Номинальный ток", "Особенности", "Отверстие под провод, мм²",
              "Параллельное подключение", "Сечение жил кв.мм", "Мощность солнечной панели", "Подсветка",
              "Поддержка мобильного приложения", "Размер", "Световой поток", "Способ монтажа", "Стартовое напряжение поля PV",
              "Степень защиты", "Тип аккумулятора", "Тип батареи", "Тип вилки", "Тип выключателя", "Тип дверцы",
              "Тип питания", "Тип лампы", "Тип счетчика", "Тип модуля", "Тип монтажа", "Тип подключения",
              "Тип светильника", "Тип стабилизатора", "Тип товара", "Тип трансформатора", "Тип цоколя", "Тип индикации",
              "Форма", "Форма люстры", "Цикл жизни", "Циклический ресурс", "Время зарядки", "Ширина"
            ],
          };

          const resultFilters = {};
          results.forEach((result) => {
            const params =
              typeof result.params === "string"
                ? JSON.parse(result.params)
                : result.params;
            Object.entries(params).forEach(([key, value]) => {
              const normalizedKey =
                filterKeyMappings[locale] && filterKeyMappings[locale][key]
                  ? filterKeyMappings[locale][key]
                  : key;

              if (allowedFilterKeys[locale].includes(normalizedKey)) {
                if (!resultFilters[normalizedKey]) {
                  resultFilters[normalizedKey] = new Set();
                }
                resultFilters[normalizedKey].add(value);
              }
            });
          });

          const sortMixedValues = (arr) => {
            return arr.sort((a, b) => {
              const numA = parseFloat(a.match(/^-?\d+\.?\d*/));
              const numB = parseFloat(b.match(/^-?\d+\.?\d*/));

              if (isNaN(numA)) return 1;
              if (isNaN(numB)) return -1;

              return numA - numB;
            });
          };

          Object.keys(resultFilters).forEach((key) => {
            resultFilters[key] = sortMixedValues(
              Array.from(resultFilters[key])
            );
          });

          return resultFilters;
        } catch (error) {
          // logToFile(
          //   `Error in productTypeFilters: ${error.message}`
          // );
          throw error;
        }
      },
    });
  },
});

const getFilteredProducts = extendType({
  type: "Query",
  definition(t) {
    t.field("filteredProducts", {
      type: "ProductListResult",
      args: {
        productTypeId: idArg(),
        subcategoryId: nonNull(idArg()),
        filters: arg({
          type: list(nonNull("FilterInput")),
        }),
        cursor: stringArg(),
        page: intArg(),

        pageSize: intArg({ default: 25 }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
        sort: list("String"),
        minPrice: floatArg(),
        maxPrice: floatArg(),
      },
      resolve: async (_, args, ctx) => {
        const {
          productTypeId,
          subcategoryId,
          filters,
          cursor,
          page,
          pageSize = 25,
          locale,
          sort,
          minPrice,
          maxPrice,
        } = args;

        // Check API token permissions
        await strapi.auth.verify(ctx.state.auth, {
          scope: ["api::product.product.find"],
        });

        const knex = strapi.db.connection;

        let query = knex("products")
          .join(
            "product_types_products_links",
            "products.id",
            "product_types_products_links.product_id"
          )
          .join(
            "product_types_subcategories_links",
            "product_types_products_links.product_type_id",
            "product_types_subcategories_links.product_type_id"
          )
          .where(
            "product_types_subcategories_links.subcategory_id",
            subcategoryId
          )
          .where("products.locale", locale);

        if (minPrice) {
          query = query.where("products.retail", ">=", minPrice);
        }

        if (maxPrice) {
          query = query.where("products.retail", "<=", maxPrice);
        }

        if (productTypeId) {
          query = query.where(
            "product_types_products_links.product_type_id",
            productTypeId
          );
        }

        if (filters && filters.length > 0) {
          const filterKeyMappings = {
            uk: {
              "Світловий потік": "Світловий потік Lm",
              "Світловий потік Lm": "Світловий потік Lm",
            },
            ru: {
              "Световой поток": "Световой поток Lm",
              "Световой поток Lm": "Световой поток Lm",
            },
          };

          query = query.andWhere(function () {
            filters.forEach(({ key, value }) => {
              const normalizedKey =
                filterKeyMappings[locale] && filterKeyMappings[locale][key]
                  ? filterKeyMappings[locale][key]
                  : key;

              const keysToCheck = Object.entries(
                filterKeyMappings[locale] || {}
              )
                .filter(([_, mappedValue]) => mappedValue === normalizedKey)
                .map(([originalKey, _]) => originalKey);

              if (keysToCheck.length > 0) {
                this.andWhere(function () {
                  keysToCheck.forEach((keyVariant) => {
                    this.orWhereRaw(
                      "params @> ?::jsonb",
                      JSON.stringify({ [keyVariant]: value })
                    );
                  });
                });
              } else {
                this.orWhereRaw(
                  "params @> ?::jsonb",
                  JSON.stringify({ [key]: value })
                );
              }
            });
          });
        }

        const countResult = await query
          .clone()
          .countDistinct("products.id as count")
          .first();
        const totalCount = parseInt(countResult.count.toString()); //TODO: if will be large dataset it should be Materialized Views

        if (cursor) {
          query = query.where("products.id", ">", cursor);
        } else if (page) {
          const offset = (page - 1) * pageSize;
          query = query.offset(offset);
        }

        if (sort && sort.length > 0) {
          sort.forEach((sortItem) => {
            const [field, direction] = sortItem.split(":");

            if (field === "retail") {
              query = query.orderBy("products.retail", direction);
            }
          });
        } else {
          query = query.orderBy("products.id", "asc");
        }

        const results = await query
          .select("products.*")
          // .orderBy("products.id", "asc")
          .limit(pageSize + 1);

        const hasNextPage = results.length > pageSize;
        const paginatedResults = results.slice(0, pageSize);

        const nextCursor = hasNextPage
          ? paginatedResults[paginatedResults.length - 1].id.toString()
          : null;

        const currentPage =
          page ||
          (cursor ? Math.floor(paginatedResults[0].id / pageSize) + 1 : 1);

        const pageCount = Math.ceil(totalCount / pageSize);

        return {
          products: paginatedResults,
          currentPage,
          pageCount,
          totalCount,
          nextCursor,
        };
      },
    });
  },
});

const getMaxProductPrice = extendType({
  type: "Query",
  definition(t) {
    t.field("maxProductPrice", {
      type: "Float",
      args: {
        subcategoryId: nonNull(idArg()),
        productTypeId: idArg(),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { subcategoryId, productTypeId, locale }, ctx) => {
        console.log("maxProductPrice resolver called with:", {
          subcategoryId,
          productTypeId,
          locale,
        });

        const knex = strapi.db.connection;

        let query = knex("products")
          .join(
            "product_types_products_links",
            "products.id",
            "product_types_products_links.product_id"
          )
          .join(
            "product_types_subcategories_links",
            "product_types_products_links.product_type_id",
            "product_types_subcategories_links.product_type_id"
          )
          .where(
            "product_types_subcategories_links.subcategory_id",
            subcategoryId
          )
          .where("products.locale", locale);

        if (productTypeId) {
          query = query.where(
            "product_types_products_links.product_type_id",
            productTypeId
          );
        }

        console.log("SQL Query:", query.toString());

        const result = await query.max("products.retail as maxRetail").first();

        console.log("Query result:", result);
        return result.maxRetail || 0;
      },
    });
  },
});

module.exports = {
  getProductTypeFilters,
  getMaxProductPrice,
  getFilteredProducts,
};
