import type { Request, Response } from 'express';
import { z } from 'zod';
import { defaultMaterials } from '../data/materials.js';
import HttpError from '../lib/http-error.js';
import PricingSettings from '../models/pricing-settings.js';

const priceUpdateSchema = z.object({
    materials: z.array(z.object({
        id: z.string().min(1),
        price: z.number().int().min(0).max(1_000_000),
    }).strict()).length(defaultMaterials.length),
    stainRemovalFee: z.number().int().min(0).max(1_000_000),
}).strict();

export const getPricing = async (_req: Request, res: Response): Promise<void> => {
    const pricing = await PricingSettings.findOneAndUpdate(
        { key: 'default' },
        { $setOnInsert: { materials: defaultMaterials } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({
        materials: pricing.materials,
        stainRemovalFee: pricing.stainRemovalFee,
        updatedAt: pricing.updatedAt,
    });
};

export const updatePricing = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const input = priceUpdateSchema.parse(req.body);
    const materialIds = input.materials.map((material) => material.id);
    if (
        new Set(materialIds).size !== defaultMaterials.length
        || defaultMaterials.some((material) => !materialIds.includes(material.id))
    ) {
        throw new HttpError(400, 'Include each material exactly once when updating prices.');
    }

    const requestedPrices = new Map(input.materials.map((material) => [material.id, material.price]));
    const materials = defaultMaterials.map((material) => ({
        ...material,
        price: requestedPrices.get(material.id)!,
    }));

    const pricing = await PricingSettings.findOneAndUpdate(
        { key: 'default' },
        {
            $set: {
                materials,
                stainRemovalFee: input.stainRemovalFee,
                updatedBy: req.auth.userId,
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json({
        materials: pricing.materials,
        stainRemovalFee: pricing.stainRemovalFee,
        updatedAt: pricing.updatedAt,
    });
};
