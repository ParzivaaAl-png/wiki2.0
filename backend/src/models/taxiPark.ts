import { query } from '../config/db';

export interface TaxiPark {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  short_description: string | null;
  full_description: string | null;
  phone: string | null;
  additional_phones: string | null;
  address: string | null;
  working_hours: string | null;
  website: string | null;
  additional_info: string | null;
  is_active: boolean;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface Promotion {
  id: number;
  title: string;
  short_description: string | null;
  full_description: string | null;
  image_url: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  external_link: string | null;
  button_text: string | null;
  is_active: boolean;
  author_id: number | null;
  created_at: Date;
  updated_at: Date;
  taxi_park_ids?: number[];
  taxi_parks?: { id: number; name: string; slug: string }[];
}

export const getAllTaxiParks = async (options: { activeOnly?: boolean } = {}): Promise<TaxiPark[]> => {
  let sql = 'SELECT * FROM taxi_parks';
  const params: any[] = [];

  if (options.activeOnly) {
    sql += ' WHERE is_active = true';
  }

  sql += ' ORDER BY position ASC, id ASC';

  const res = await query(sql, params);
  return res.rows;
};

export const getTaxiParkBySlug = async (slug: string): Promise<TaxiPark | null> => {
  const res = await query('SELECT * FROM taxi_parks WHERE slug = $1 LIMIT 1', [slug]);
  return res.rows[0] || null;
};

export const getTaxiParkById = async (id: number): Promise<TaxiPark | null> => {
  const res = await query('SELECT * FROM taxi_parks WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
};

export const createTaxiPark = async (data: Partial<TaxiPark>): Promise<TaxiPark> => {
  const res = await query(
    `INSERT INTO taxi_parks (
      name, slug, logo_url, short_description, full_description,
      phone, additional_phones, address, working_hours, website,
      additional_info, is_active, position
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, true), COALESCE($13, 0))
    RETURNING *`,
    [
      data.name,
      data.slug,
      data.logo_url || null,
      data.short_description || null,
      data.full_description || null,
      data.phone || null,
      data.additional_phones || null,
      data.address || null,
      data.working_hours || null,
      data.website || null,
      data.additional_info || null,
      data.is_active !== undefined ? data.is_active : true,
      data.position || 0,
    ]
  );
  return res.rows[0];
};

export const updateTaxiPark = async (id: number, data: Partial<TaxiPark>): Promise<TaxiPark | null> => {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const allowedFields = [
    'name', 'slug', 'logo_url', 'short_description', 'full_description',
    'phone', 'additional_phones', 'address', 'working_hours', 'website',
    'additional_info', 'is_active', 'position'
  ];

  for (const field of allowedFields) {
    if ((data as any)[field] !== undefined) {
      fields.push(`${field} = $${paramIdx}`);
      params.push((data as any)[field]);
      paramIdx++;
    }
  }

  if (fields.length === 0) {
    return getTaxiParkById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const res = await query(
    `UPDATE taxi_parks SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  return res.rows[0] || null;
};

export const deleteTaxiPark = async (id: number): Promise<boolean> => {
  const res = await query('DELETE FROM taxi_parks WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
};

export const reorderTaxiParks = async (items: { id: number; position: number }[]): Promise<void> => {
  for (const item of items) {
    await query('UPDATE taxi_parks SET position = $1 WHERE id = $2', [item.position, item.id]);
  }
};

// ==========================================
// PROMOTIONS CRUD & MANY-TO-MANY RELATION
// ==========================================

export const getAllPromotions = async (options: { activeOnly?: boolean; taxiParkId?: number } = {}): Promise<Promotion[]> => {
  let sql = `
    SELECT p.*,
      COALESCE(
        json_agg(
          json_build_object('id', tp.id, 'name', tp.name, 'slug', tp.slug)
        ) FILTER (WHERE tp.id IS NOT NULL),
        '[]'::json
      ) as taxi_parks
    FROM promotions p
    LEFT JOIN promotion_taxi_parks ptp ON p.id = ptp.promotion_id
    LEFT JOIN taxi_parks tp ON ptp.taxi_park_id = tp.id
  `;

  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (options.activeOnly) {
    whereConditions.push(`p.is_active = true`);
    whereConditions.push(`(p.start_date IS NULL OR p.start_date <= CURRENT_TIMESTAMP)`);
    whereConditions.push(`(p.end_date IS NULL OR p.end_date >= CURRENT_TIMESTAMP)`);
  }

  if (options.taxiParkId) {
    whereConditions.push(`p.id IN (SELECT promotion_id FROM promotion_taxi_parks WHERE taxi_park_id = $${paramIdx})`);
    params.push(options.taxiParkId);
    paramIdx++;
  }

  if (whereConditions.length > 0) {
    sql += ` WHERE ` + whereConditions.join(' AND ');
  }

  sql += ` GROUP BY p.id ORDER BY p.created_at DESC`;

  const res = await query(sql, params);
  return res.rows.map((row) => ({
    ...row,
    taxi_park_ids: Array.isArray(row.taxi_parks) ? row.taxi_parks.map((t: any) => t.id) : [],
  }));
};

export const getPromotionById = async (id: number): Promise<Promotion | null> => {
  const sql = `
    SELECT p.*,
      COALESCE(
        json_agg(
          json_build_object('id', tp.id, 'name', tp.name, 'slug', tp.slug)
        ) FILTER (WHERE tp.id IS NOT NULL),
        '[]'::json
      ) as taxi_parks
    FROM promotions p
    LEFT JOIN promotion_taxi_parks ptp ON p.id = ptp.promotion_id
    LEFT JOIN taxi_parks tp ON ptp.taxi_park_id = tp.id
    WHERE p.id = $1
    GROUP BY p.id
  `;
  const res = await query(sql, [id]);
  if (!res.rows[0]) return null;

  const row = res.rows[0];
  return {
    ...row,
    taxi_park_ids: Array.isArray(row.taxi_parks) ? row.taxi_parks.map((t: any) => t.id) : [],
  };
};

export const createPromotion = async (
  data: Partial<Promotion>,
  taxiParkIds: number[] = []
): Promise<Promotion> => {
  const res = await query(
    `INSERT INTO promotions (
      title, short_description, full_description, image_url,
      start_date, end_date, external_link, button_text, is_active, author_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'Подробнее'), COALESCE($9, true), $10)
    RETURNING *`,
    [
      data.title,
      data.short_description || null,
      data.full_description || null,
      data.image_url || null,
      data.start_date || null,
      data.end_date || null,
      data.external_link || null,
      data.button_text || 'Подробнее',
      data.is_active !== undefined ? data.is_active : true,
      data.author_id || null,
    ]
  );

  const promotion = res.rows[0];

  if (taxiParkIds && taxiParkIds.length > 0) {
    for (const parkId of taxiParkIds) {
      await query(
        `INSERT INTO promotion_taxi_parks (promotion_id, taxi_park_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [promotion.id, parkId]
      );
    }
  }

  return (await getPromotionById(promotion.id)) || promotion;
};

export const updatePromotion = async (
  id: number,
  data: Partial<Promotion>,
  taxiParkIds?: number[]
): Promise<Promotion | null> => {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const allowedFields = [
    'title', 'short_description', 'full_description', 'image_url',
    'start_date', 'end_date', 'external_link', 'button_text', 'is_active'
  ];

  for (const field of allowedFields) {
    if ((data as any)[field] !== undefined) {
      fields.push(`${field} = $${paramIdx}`);
      params.push((data as any)[field]);
      paramIdx++;
    }
  }

  if (fields.length > 0) {
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    await query(
      `UPDATE promotions SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
      params
    );
  }

  if (taxiParkIds !== undefined) {
    await query('DELETE FROM promotion_taxi_parks WHERE promotion_id = $1', [id]);
    for (const parkId of taxiParkIds) {
      await query(
        `INSERT INTO promotion_taxi_parks (promotion_id, taxi_park_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, parkId]
      );
    }
  }

  return getPromotionById(id);
};

export const deletePromotion = async (id: number): Promise<boolean> => {
  const res = await query('DELETE FROM promotions WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
};
