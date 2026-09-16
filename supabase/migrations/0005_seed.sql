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
