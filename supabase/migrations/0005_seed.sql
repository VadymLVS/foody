-- PantrySync · системные данные.
-- Категории и справочник хранятся ключами, подписи берутся из словаря (D-034).

-- Категории продуктов — в порядке отделов магазина, не по алфавиту (D-007)
insert into categories (kitchen_id, kind, key, sort_order) values
  (null,'product','vegetables', 10),
  (null,'product','fruits',     20),
  (null,'product','dairy',      30),
  (null,'product','meat_fish',  40),
  (null,'product','bakery',     50),
  (null,'product','pantry',     60),
  (null,'product','frozen',     70),
  (null,'product','drinks',     80),
  (null,'product','sweets',     90),
  (null,'product','household', 100),
  (null,'product','other',     110)
on conflict do nothing;

-- Категории блюд
insert into categories (kitchen_id, kind, key, sort_order) values
  (null,'dish','soups',      10),
  (null,'dish','mains',      20),
  (null,'dish','salads',     30),
  (null,'dish','breakfasts', 40),
  (null,'dish','baking',     50),
  (null,'dish','drinks',     60),
  (null,'dish','other',      70)
on conflict do nothing;

-- Справочник автокомплита. key совпадает с именем файла в public/library/products.
insert into product_suggestions (key, category_key, unit) values
  ('milk','dairy','l'),          ('kefir','dairy','l'),
  ('sour_cream','dairy','pack'), ('cottage_cheese','dairy','pack'),
  ('cheese','dairy','g'),        ('butter','dairy','pack'),
  ('eggs','dairy','pcs'),        ('yogurt','dairy','pack'),
  ('bread','bakery','pcs'),      ('loaf','bakery','pcs'),
  ('potato','vegetables','kg'),  ('carrot','vegetables','kg'),
  ('onion','vegetables','kg'),   ('garlic','vegetables','pcs'),
  ('tomato','vegetables','kg'),  ('cherry_tomato','vegetables','pack'),
  ('cucumber','vegetables','kg'),('cabbage','vegetables','pcs'),
  ('beet','vegetables','kg'),    ('pepper','vegetables','kg'),
  ('apple','fruits','kg'),       ('banana','fruits','kg'),
  ('lemon','fruits','pcs'),      ('orange','fruits','kg'),
  ('chicken','meat_fish','kg'),  ('beef','meat_fish','kg'),
  ('pork','meat_fish','kg'),     ('mince','meat_fish','kg'),
  ('fish','meat_fish','kg'),     ('salmon','meat_fish','kg'),
  ('rice','pantry','kg'),        ('buckwheat','pantry','kg'),
  ('pasta','pantry','pack'),     ('flour','pantry','kg'),
  ('sugar','pantry','kg'),       ('salt','pantry','pack'),
  ('oil','pantry','l'),          ('tea','drinks','pack'),
  ('coffee','drinks','pack'),    ('water','drinks','l')
on conflict (key) do nothing;

-- Расширение справочника для карусели первого запуска (D-040).
-- Смахивать сорок позиций — мало; нужен набор, покрывающий обычную корзину.
insert into product_suggestions (key, category_key, unit) values
  ('ryazhenka','dairy','l'),        ('cream','dairy','pack'),
  ('mozzarella','dairy','pack'),    ('feta','dairy','pack'),
  ('margarine','dairy','pack'),
  ('lavash','bakery','pcs'),        ('buns','bakery','pcs'),
  ('crispbread','bakery','pack'),
  ('zucchini','vegetables','kg'),   ('eggplant','vegetables','kg'),
  ('broccoli','vegetables','kg'),   ('cauliflower','vegetables','pcs'),
  ('mushrooms','vegetables','kg'),  ('greens','vegetables','pack'),
  ('lettuce','vegetables','pcs'),   ('celery','vegetables','pcs'),
  ('pumpkin','vegetables','kg'),    ('corn','vegetables','pack'),
  ('pear','fruits','kg'),           ('grapes','fruits','kg'),
  ('peach','fruits','kg'),          ('plum','fruits','kg'),
  ('watermelon','fruits','pcs'),    ('melon','fruits','pcs'),
  ('strawberry','fruits','pack'),   ('blueberry','fruits','pack'),
  ('avocado','fruits','pcs'),       ('kiwi','fruits','pcs'),
  ('turkey','meat_fish','kg'),      ('sausages','meat_fish','pack'),
  ('bacon','meat_fish','pack'),     ('ham','meat_fish','g'),
  ('shrimp','meat_fish','pack'),    ('tuna_canned','meat_fish','pack'),
  ('herring','meat_fish','pack'),
  ('oats','pantry','kg'),           ('lentils','pantry','kg'),
  ('beans','pantry','pack'),        ('chickpeas','pantry','pack'),
  ('couscous','pantry','pack'),     ('bulgur','pantry','pack'),
  ('olive_oil','pantry','l'),       ('vinegar','pantry','l'),
  ('soy_sauce','pantry','ml'),      ('tomato_paste','pantry','pack'),
  ('mayonnaise','pantry','pack'),   ('ketchup','pantry','pack'),
  ('mustard','pantry','pack'),      ('honey','pantry','pack'),
  ('pepper_ground','pantry','pack'),('bay_leaf','pantry','pack'),
  ('baking_powder','pantry','pack'),('yeast','pantry','pack'),
  ('peanut_butter','pantry','pack'),('jam','pantry','pack'),
  ('nuts','pantry','pack'),         ('raisins','pantry','pack'),
  ('frozen_vegetables','frozen','pack'), ('frozen_berries','frozen','pack'),
  ('dumplings','frozen','pack'),    ('ice_cream','frozen','pack'),
  ('pizza_frozen','frozen','pcs'),
  ('juice','drinks','l'),           ('sparkling_water','drinks','l'),
  ('lemonade','drinks','l'),        ('beer','drinks','pack'),
  ('wine','drinks','pcs'),
  ('chocolate','sweets','pcs'),     ('cookies','sweets','pack'),
  ('candy','sweets','pack'),        ('waffles','sweets','pack'),
  ('chips','sweets','pack'),
  ('toilet_paper','household','pack'), ('paper_towels','household','pack'),
  ('dish_soap','household','pcs'),  ('laundry_detergent','household','pack'),
  ('sponges','household','pack'),   ('trash_bags','household','pack'),
  ('soap','household','pcs'),       ('shampoo','household','pcs'),
  ('toothpaste','household','pcs')
on conflict (key) do nothing;
