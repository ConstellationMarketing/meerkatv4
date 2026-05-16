import { supabase } from "@/lib/supabase";

export async function seedTestArticle() {
  try {
    const testArticle = {
      id: "test-article-abdin",
      article_id: "test-article-id-12345",
      client_name: "Abdin Law",
      client_id: "86dxhw7vt",
      keyword: "immigration lawyer orlando",
      sections: [
        {
          id: "1",
          title: "Introduction",
          description: "short introduction",
          content: "Learn about our immigration law services in Orlando",
        },
        {
          id: "2",
          title: "How We Can Help",
          description: "explain how our firm can help",
          content:
            "We specialize in family-based immigration, employment visas, and more",
        },
        {
          id: "3",
          title: "Why Choose Us",
          description: "explain the benefits of choosing us",
          content:
            "With over 20 years of experience, we provide expert guidance",
        },
        {
          id: "4",
          title: "What to Expect",
          description:
            "specifics about legal process and how to work with our firm",
          content:
            "Our process is transparent and client-focused from start to finish",
        },
        {
          id: "5",
          title: "CTA/Conclusion",
          description:
            "concise summary of main point, clear next steps to contact firm.",
          content: "Contact us today for a free consultation",
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      webhook_sent: true,
      received_article: {
        content: `
        <h1>Your Immigration Lawyer in Orlando, Florida</h1>
        <p>Navigating the U.S. immigration system can be challenging and complex. Whether you're seeking a visa, applying for citizenship, or dealing with immigration issues, Abdin Law is here to help. Our experienced immigration lawyers in Orlando, Florida, are dedicated to providing comprehensive legal services tailored to your needs.</p>

        <h2>Our Immigration Services</h2>
        <p>We offer a wide range of immigration services, including:</p>
        <ul>
          <li>Family-based immigration petitions</li>
          <li>Employment-based visas (H-1B, L-1, EB-3, etc.)</li>
          <li>Naturalization and citizenship applications</li>
          <li>Deportation defense and removal proceedings</li>
          <li>Asylum and refugee applications</li>
          <li>Business immigration and investor visas</li>
        </ul>

        <h2>Why Choose Abdin Law?</h2>
        <p>With over 20 years of experience in immigration law, we understand the complexities of the system. Our team is committed to achieving the best possible outcomes for our clients. We pride ourselves on:</p>
        <ul>
          <li>Expert knowledge of immigration law and procedures</li>
          <li>Personalized attention to each client's case</li>
          <li>Clear communication throughout the process</li>
          <li>Proven track record of success</li>
        </ul>

        <h2>The Immigration Process</h2>
        <p>Our process is transparent and client-focused. When you work with us, you can expect:</p>
        <ol>
          <li><strong>Initial Consultation:</strong> We'll discuss your situation and determine the best course of action.</li>
          <li><strong>Case Preparation:</strong> We'll gather documents and prepare your petition or application.</li>
          <li><strong>Filing:</strong> We'll submit your case to the appropriate immigration agency.</li>
          <li><strong>Representation:</strong> We'll represent you throughout the entire process, including any interviews or hearings.</li>
          <li><strong>Resolution:</strong> We'll work toward a successful resolution of your case.</li>
        </ol>

        <h2>Contact Us Today</h2>
        <p>Don't let immigration issues overwhelm you. Contact Abdin Law today to schedule your free consultation with an experienced immigration lawyer in Orlando. We're ready to help you navigate the immigration system and achieve your goals.</p>
        <p><strong>Call us at (407) 555-0123 or visit our office at 123 Immigration Way, Orlando, FL 32801.</strong></p>
      `,
        title: "Your Immigration Lawyer in Orlando, Florida | Abdin Law",
        meta: "Experienced immigration lawyers in Orlando, FL. We provide family-based, employment, and citizenship services. Free consultation available.",
        receivedAt: new Date().toISOString(),
      },
    };

    // Check if test article already exists
    const { data: existing, error: selectError } = await supabase
      .from("article_outlines")
      .select("id")
      .eq("id", testArticle.id)
      .maybeSingle();

    if (selectError) {
      console.error("Error checking existing article:", selectError);
      throw new Error("Failed to check existing article");
    }

    if (existing) {
      console.log("Test article already exists, updating...");
      const { error: updateError } = await supabase
        .from("article_outlines")
        .update(testArticle)
        .eq("id", testArticle.id);

      if (updateError) {
        console.error("Error updating test article:", updateError);
        throw new Error("Failed to update test article");
      }

      console.log("Test article updated successfully");
      return true;
    } else {
      console.log("Creating test article...");
      console.log("Test article data:", JSON.stringify(testArticle, null, 2));

      const { data, error: insertError } = await supabase
        .from("article_outlines")
        .insert([testArticle]);

      console.log("Insert response - data:", data);
      console.log("Insert response - error:", insertError);

      if (insertError) {
        console.error("Detailed error creating test article:", {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        });
        throw new Error(
          `Failed to create test article: ${insertError.message || insertError.code || "Unknown error"}`,
        );
      }

      console.log("Test article created successfully");
      return true;
    }
  } catch (error) {
    console.error("Exception in seedTestArticle:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred while seeding test article");
  }
}
