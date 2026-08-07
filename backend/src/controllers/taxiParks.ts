import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as TaxiParkModel from '../models/taxiPark';

export const getTaxiParks = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const parks = await TaxiParkModel.getAllTaxiParks({ activeOnly });
    res.json(parks);
  } catch (error: any) {
    console.error('Error fetching taxi parks:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getTaxiParkBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const park = await TaxiParkModel.getTaxiParkBySlug(slug);

    if (!park) {
      return res.status(404).json({ error: 'Таксопарк не найден' });
    }

    res.json(park);
  } catch (error: any) {
    console.error('Error fetching taxi park by slug:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createTaxiPark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, slug, logo_url, short_description, full_description, phone, additional_phones, address, working_hours, website, additional_info, is_active, position } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Название и Slug обязательны для заполнения.' });
    }

    const existing = await TaxiParkModel.getTaxiParkBySlug(slug);
    if (existing) {
      return res.status(400).json({ error: 'Таксопарк с таким slug уже существует.' });
    }

    const created = await TaxiParkModel.createTaxiPark({
      name,
      slug,
      logo_url,
      short_description,
      full_description,
      phone,
      additional_phones,
      address,
      working_hours,
      website,
      additional_info,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      position: position ? Number(position) : 0,
    });

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating taxi park:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateTaxiPark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parkId = Number(id);

    if (!parkId) {
      return res.status(400).json({ error: 'Некорректный ID таксопарка.' });
    }

    const existing = await TaxiParkModel.getTaxiParkById(parkId);
    if (!existing) {
      return res.status(404).json({ error: 'Таксопарк не найден' });
    }

    const updated = await TaxiParkModel.updateTaxiPark(parkId, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating taxi park:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteTaxiPark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parkId = Number(id);

    if (!parkId) {
      return res.status(400).json({ error: 'Некорректный ID таксопарка.' });
    }

    const success = await TaxiParkModel.deleteTaxiPark(parkId);
    if (!success) {
      return res.status(404).json({ error: 'Таксопарк не найден' });
    }

    res.json({ message: 'Таксопарк успешно удален' });
  } catch (error: any) {
    console.error('Error deleting taxi park:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const reorderTaxiParks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Некорректный формат данных' });
    }

    await TaxiParkModel.reorderTaxiParks(items);
    res.json({ message: 'Порядок таксопарков обновлен' });
  } catch (error: any) {
    console.error('Error reordering taxi parks:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const uploadTaxiParkLogo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл логотипа не загружен.' });
    }

    const logoUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
    res.status(201).json({ message: 'Логотип успешно загружен', url: logoUrl });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ==========================================
// PROMOTIONS CONTROLLERS
// ==========================================

export const getPromotions = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const taxiParkId = req.query.taxiParkId ? Number(req.query.taxiParkId) : undefined;

    const promotions = await TaxiParkModel.getAllPromotions({ activeOnly, taxiParkId });
    res.json(promotions);
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getPromotionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promotion = await TaxiParkModel.getPromotionById(Number(id));

    if (!promotion) {
      return res.status(404).json({ error: 'Акция не найдена' });
    }

    res.json(promotion);
  } catch (error: any) {
    console.error('Error fetching promotion by ID:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createPromotion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, short_description, full_description, image_url, start_date, end_date, external_link, button_text, is_active, taxi_park_ids } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Название акции обязательно для заполнения.' });
    }

    const authorId = req.user ? req.user.id : null;
    const created = await TaxiParkModel.createPromotion(
      {
        title,
        short_description,
        full_description,
        image_url,
        start_date,
        end_date,
        external_link,
        button_text,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        author_id: authorId,
      },
      Array.isArray(taxi_park_ids) ? taxi_park_ids : []
    );

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updatePromotion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const promoId = Number(id);
    const { taxi_park_ids, ...data } = req.body;

    if (!promoId) {
      return res.status(400).json({ error: 'Некорректный ID акции.' });
    }

    const updated = await TaxiParkModel.updatePromotion(
      promoId,
      data,
      Array.isArray(taxi_park_ids) ? taxi_park_ids : undefined
    );

    if (!updated) {
      return res.status(404).json({ error: 'Акция не найдена' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deletePromotion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const promoId = Number(id);

    if (!promoId) {
      return res.status(400).json({ error: 'Некорректный ID акции.' });
    }

    const success = await TaxiParkModel.deletePromotion(promoId);
    if (!success) {
      return res.status(404).json({ error: 'Акция не найдена' });
    }

    res.json({ message: 'Акция успешно удалена' });
  } catch (error: any) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const uploadPromotionBanner = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл баннера не загружен.' });
    }

    const bannerUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
    res.status(201).json({ message: 'Баннер успешно загружен', url: bannerUrl });
  } catch (error: any) {
    console.error('Error uploading banner:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
